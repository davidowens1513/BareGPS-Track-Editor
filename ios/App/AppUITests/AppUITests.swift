import XCTest

/// Actual system Files/share UI, against the separate native-test app only.
final class AppUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.baregps.trackeditor.nativetest")
    override func setUpWithError() throws {
        continueAfterFailure = false
        app.launch()
    }
    override func tearDownWithError() throws {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "Native workflow final screen"; shot.lifetime = .keepAlways; add(shot)
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "Native workflow accessibility"; tree.lifetime = .keepAlways; add(tree)
    }
    func webButton(_ name: String) -> XCUIElement { app.webViews.buttons[name].firstMatch }
    func tapWeb(_ name: String) {
        let button = webButton(name)
        for _ in 0..<8 {
            if button.exists && button.isHittable { button.tap(); return }
            app.swipeUp()
        }
        XCTAssertTrue(button.waitForExistence(timeout: 10), "Missing \(name)\n\(app.debugDescription)")
        button.tap()
    }
    func top() { for _ in 0..<5 { app.swipeDown() } }
    func openFiles() {
        top()
        if webButton("Open GPX file(s)").exists { tapWeb("Open GPX file(s)") }
        else { tapWeb("Open files") }
    }
    func localTestFolder() {
        let browse = app.buttons["Browse"].firstMatch
        if browse.waitForExistence(timeout: 2) { browse.tap() }
        let local = app.staticTexts["On My iPhone"].firstMatch
        if !local.waitForExistence(timeout: 2) {
            let back = app.navigationBars.buttons["Browse"].firstMatch
            if back.exists { back.tap() }
        }
        if local.waitForExistence(timeout: 4) { local.tap() }
        let folder = app.cells.containing(NSPredicate(format: "label CONTAINS %@", "BareGPS Native Tests")).firstMatch
        if folder.waitForExistence(timeout: 4) { folder.tap() }
    }
    func importFile(_ name: String) {
        openFiles()
        localTestFolder()
        let file = app.cells.matching(NSPredicate(format: "label CONTAINS %@", name)).firstMatch
        XCTAssertTrue(file.waitForExistence(timeout: 10), "Missing test file \(name)\n\(app.debugDescription)")
        file.tap()
        let open = app.buttons["Open"].firstMatch
        if open.waitForExistence(timeout: 2) { open.tap() }
        XCTAssertTrue(webButton("Add to Route Plan").waitForExistence(timeout: 15), app.debugDescription)
    }
    func cancelSystemSheet() {
        let cancel = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Cancel")).firstMatch
        XCTAssertTrue(cancel.waitForExistence(timeout: 10), app.debugDescription)
        cancel.tap()
    }
    func closeShare() {
        let sheet = app.otherElements["ActivityListView"].firstMatch
        XCTAssertTrue(sheet.waitForExistence(timeout: 5), "Native activity sheet must be open")
        let close = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Close")).firstMatch
        if close.exists && close.isHittable { close.tap() }
        else {
            // Current iOS uses a floating system sheet with no Close button.
            // Tapping its dimmed backdrop is the user-visible cancel action.
            let screen = app.frame
            if sheet.frame.minY > screen.minY + 80 {
                app.coordinate(withNormalizedOffset: .zero)
                    .withOffset(CGVector(dx: screen.width / 2, dy: sheet.frame.minY - screen.minY - 20)).tap()
            } else { sheet.swipeDown() }
        }
        XCTAssertTrue(sheet.waitForNonExistence(timeout: 10), "Cancelling sharing must dismiss the system sheet")
    }
    func testSystemFilesRoundTripAndSharingCancellation() {
        XCTAssertTrue(webButton("Edit Existing").waitForExistence(timeout: 20), app.debugDescription)
        tapWeb("Edit Existing")
        openFiles(); cancelSystemSheet()
        XCTAssertTrue(webButton("Open GPX file(s)").isEnabled)
        importFile("BareGPS-native-workflow")
        tapWeb("Reverse")
        tapWeb("Add to Route Plan")
        tapWeb("Confirm Route")
        XCTAssertTrue(webButton("Save Route").waitForExistence(timeout: 15), app.debugDescription)
        tapWeb("Save Route"); cancelSystemSheet()
        tapWeb("Save Route")
        localTestFolder()
        let save = app.buttons["Save"].firstMatch
        XCTAssertTrue(save.waitForExistence(timeout: 10), app.debugDescription)
        save.tap()
        let replace = app.buttons["Replace"].firstMatch
        if replace.waitForExistence(timeout: 2) { replace.tap() }
        XCTAssertTrue(webButton("Expand Route Card").waitForExistence(timeout: 15), app.debugDescription)
        tapWeb("Expand Route Card")
        tapWeb("Share Text")
        XCTAssertTrue(app.otherElements["ActivityListView"].waitForExistence(timeout: 3) || app.buttons["Copy"].exists || app.buttons["Close"].exists, app.debugDescription)
        closeShare()
        tapWeb("Share PDF")
        XCTAssertTrue(app.otherElements["ActivityListView"].waitForExistence(timeout: 5), app.debugDescription)
        closeShare()
        tapWeb("Collapse Route Card")
        importFile("Edited Route")
        XCTAssertTrue(webButton("Remove Edited Route").waitForExistence(timeout: 10), app.debugDescription)
        // The host runner also reads Documents/Edited Route.gpx and verifies point order, heights and names.
    }
}
