import XCTest
final class AppUITests: XCTestCase {
    func testStandaloneLaunch() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))
        XCTAssertFalse(app.buttons["Create New"].exists)
        XCTAssertFalse(app.buttons["Edit Existing"].exists)
    }
}
