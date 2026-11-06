import XCTest

final class AppUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }
    func testDocumentPickerCancellationKeepsEditorReady() {
        let app = XCUIApplication(); app.launch()
        let open = app.webViews.buttons["Open files"].firstMatch
        XCTAssertTrue(open.waitForExistence(timeout: 20), app.debugDescription)
        open.tap()
        let cancel = app.buttons["Cancel"].firstMatch
        XCTAssertTrue(cancel.waitForExistence(timeout: 30), app.debugDescription)
        cancel.tap()
        XCTAssertTrue(open.waitForExistence(timeout: 10))
        XCTAssertTrue(open.isEnabled)
    }
    func testImportAndSaveThroughFiles() {
        let app = XCUIApplication(); app.launch()
        let open = app.webViews.buttons["Open GPX files"]
        if !open.waitForExistence(timeout: 5) {
            // A previous successful run may have restored its workspace.
            let existing = app.webViews.buttons["Open files"].firstMatch
            XCTAssertTrue(existing.waitForExistence(timeout: 15), app.debugDescription)
            existing.tap()
        } else { open.tap() }
        let fixture = app.cells.matching(NSPredicate(format: "label CONTAINS %@", "Native fixture")).firstMatch
        if !fixture.waitForExistence(timeout: 5) {
            let browse = app.buttons["Browse"].firstMatch
            if browse.waitForExistence(timeout: 5) { browse.tap() }
            let local = app.staticTexts["On My iPhone"].firstMatch
            if local.waitForExistence(timeout: 4) { local.tap() }
            let folder = app.cells.matching(NSPredicate(format: "label BEGINSWITH %@", "BareGPS Track Editor")).firstMatch
            if !fixture.exists && folder.waitForExistence(timeout: 4) { folder.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3)).tap() }
        }
        let found=fixture.waitForExistence(timeout: 12)
        let shot=XCTAttachment(screenshot:app.screenshot());shot.name="Files import picker";shot.lifetime = .keepAlways;add(shot)
        XCTAssertTrue(found, app.debugDescription)
        fixture.tap()
        let importOpen = app.buttons["Open"].firstMatch
        if importOpen.waitForExistence(timeout: 2) { importOpen.tap() }
        let save = app.webViews.buttons["Save section"].firstMatch
        XCTAssertTrue(save.waitForExistence(timeout: 15), app.debugDescription)
        save.tap()
        let saveFile = app.buttons["Save"].firstMatch
        XCTAssertTrue(saveFile.waitForExistence(timeout: 10), app.debugDescription)
        saveFile.tap()
        let replace = app.buttons["Replace"].firstMatch
        if replace.waitForExistence(timeout: 2) { replace.tap() }
        XCTAssertTrue(app.webViews.staticTexts["GPX saved to your chosen location."].waitForExistence(timeout: 15), app.debugDescription)
    }
}
