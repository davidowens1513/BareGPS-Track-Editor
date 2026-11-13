import UIKit
import Capacitor
import WebKit
import UniformTypeIdentifiers

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool { true }
    func application(_ application: UIApplication, configurationForConnecting session: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration", sessionRole: session.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

final class BareBridgeViewController: CAPBridgeViewController {
    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        // WKWebView can ignore CSS touch-action and Capacitor's zoomEnabled=false
        // for double taps. Keep only the native app viewport fixed; Leaflet owns
        // map pinch/double-tap zoom, and the public web viewport stays scalable.
        configuration.ignoresViewportScaleLimits = false
        let viewportScript = WKUserScript(source: """
            const viewport = document.querySelector('meta[name="viewport"]');
            if (viewport) {
                viewport.content = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
            }
            """, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        configuration.userContentController.addUserScript(viewportScript)
        return super.webView(with: frame, configuration: configuration)
    }

    override func capacitorDidLoad() { bridge?.registerPluginInstance(BareFilesPlugin()) }
}

// Read security-scoped URLs immediately: a Files provider can revoke access later.
final class IncomingGPX {
    static let shared = IncomingGPX()
    var files: [[String: String]] = []
    var errors: [String] = []
    static let opened = Notification.Name("BareGPSFilesOpened")
    static func read(_ url: URL) throws -> [String: String] {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard size <= 15 * 1024 * 1024 else { throw NSError(domain: "BareGPS", code: 1, userInfo: [NSLocalizedDescriptionKey: "\(url.lastPathComponent) is over 15 MB. Choose a smaller GPX file."]) }
        var content: Data?
        var readError: Error?
        var coordinationError: NSError?
        NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordinationError) { coordinated in
            do { content = try Data(contentsOf: coordinated) } catch { readError = error }
        }
        if let error = coordinationError ?? readError as NSError? { throw error }
        guard let data = content, data.count <= 15 * 1024 * 1024 else { throw NSError(domain: "BareGPS", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not read GPX file, or the file is over 15 MB."]) }
        return ["name": url.lastPathComponent, "data": data.base64EncodedString()]
    }
    func receive(_ urls: [URL]) {
        for url in urls.prefix(20) {
            do { files.append(try Self.read(url)) }
            catch { errors.append("\(url.lastPathComponent): \(error.localizedDescription)") }
        }
        if urls.count > 20 { errors.append("Only the first 20 files were opened. Open the remaining files separately.") }
        NotificationCenter.default.post(name: Self.opened, object: nil)
    }
}

@objc(BareFilesPlugin)
class BareFilesPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    let identifier = "BareFilesPlugin"
    let jsName = "BareFiles"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "shareFile", returnType: CAPPluginReturnPromise), CAPPluginMethod(name: "shareText", returnType: CAPPluginReturnPromise), CAPPluginMethod(name: "pick", returnType: CAPPluginReturnPromise), CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise), CAPPluginMethod(name: "pending", returnType: CAPPluginReturnPromise)]
    private var operation: CAPPluginCall?
    private var exporting = false
    private var temporaryURL: URL?
    private var observer: NSObjectProtocol?
    override func load() {
        observer = NotificationCenter.default.addObserver(forName: IncomingGPX.opened, object: nil, queue: .main) { [weak self] _ in self?.notifyListeners("filesOpened", data: [:], retainUntilConsumed: true) }
    }
    deinit { if let observer = observer { NotificationCenter.default.removeObserver(observer) } }
    @objc func pending(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let queue = IncomingGPX.shared
            call.resolve(["files": queue.files, "errors": queue.errors])
            queue.files = []; queue.errors = []
        }
    }
    @objc func pick(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.operation == nil else { call.reject("A file action is already open."); return }
            self.operation = call; self.exporting = false
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item], asCopy: true)
            picker.allowsMultipleSelection = true; picker.delegate = self
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }
    @objc func shareFile(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let encoded = call.getString("data"), let data = Data(base64Encoded: encoded), let name = call.getString("name"), let presenter = self.bridge?.viewController else { call.reject("Could not prepare PDF."); return }
            do {
                let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let url = directory.appendingPathComponent((name as NSString).lastPathComponent)
                try data.write(to: url, options: .atomic)
                let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
                if let popover = sheet.popoverPresentationController {
                    popover.sourceView = presenter.view
                    popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 0, height: 0)
                    popover.permittedArrowDirections = []
                }
                sheet.completionWithItemsHandler = { _, _, _, error in
                    try? FileManager.default.removeItem(at: directory)
                    if let error = error { call.reject("Could not share PDF: \(error.localizedDescription)") } else { call.resolve() }
                }
                presenter.present(sheet, animated: true)
            } catch { call.reject("Could not prepare PDF: \(error.localizedDescription)") }
        }
    }
    @objc func shareText(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let text = call.getString("text"), let presenter = self.bridge?.viewController else {
                call.reject("Could not prepare the routecard."); return
            }
            let sheet = UIActivityViewController(activityItems: [text], applicationActivities: nil)
            if let popover = sheet.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 0, height: 0)
                popover.permittedArrowDirections = []
            }
            sheet.completionWithItemsHandler = { _, _, _, error in
                if let error = error { call.reject("Could not share routecard: \(error.localizedDescription)") }
                else { call.resolve() }
            }
            presenter.present(sheet, animated: true)
        }
    }
    @objc func save(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.operation == nil else { call.reject("A file action is already open."); return }
            guard let encoded = call.getString("data"), let data = Data(base64Encoded: encoded), let name = call.getString("name") else { call.reject("Could not prepare the GPX file."); return }
            do {
                let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let url = directory.appendingPathComponent((name as NSString).lastPathComponent)
                try data.write(to: url, options: .atomic)
                self.operation = call; self.exporting = true; self.temporaryURL = url
                let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
                picker.delegate = self
                self.bridge?.viewController?.present(picker, animated: true)
            } catch { call.reject("Could not prepare GPX export: \(error.localizedDescription)") }
        }
    }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = operation else { return }
        defer { finish() }
        if exporting { call.resolve(["saved": true]); return }
        guard urls.count <= 20 else { call.reject("Choose up to 20 GPX files at a time."); return }
        do {
            var bytes = 0
            var files: [[String: String]] = []
            for url in urls {
                let file = try IncomingGPX.read(url)
                bytes += (file["data"]?.count ?? 0) * 3 / 4
                guard bytes <= 30 * 1024 * 1024 else { throw NSError(domain: "BareGPS", code: 3, userInfo: [NSLocalizedDescriptionKey: "Choose up to 30 MB of files at a time."]) }
                files.append(file)
            }
            call.resolve(["files": files])
        }
        catch { call.reject("Could not open the selected files: \(error.localizedDescription)") }
    }
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        operation?.reject("File action cancelled.", "CANCELLED"); finish()
    }
    private func finish() {
        operation = nil
        if let url = temporaryURL { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        temporaryURL = nil
    }
}
