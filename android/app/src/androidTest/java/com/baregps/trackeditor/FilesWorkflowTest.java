package com.baregps.trackeditor;

import android.content.Context;
import android.content.Intent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.w3c.dom.*;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;
import static androidx.test.espresso.web.sugar.Web.onWebView;
import static androidx.test.espresso.web.webdriver.DriverAtoms.*;
import static androidx.test.espresso.web.assertion.WebViewAssertions.webMatches;
import static org.hamcrest.Matchers.*;
import androidx.test.espresso.web.webdriver.Locator;

/** Runs only in the separate native-test application, using actual system UI. */
@RunWith(AndroidJUnit4.class)
public class FilesWorkflowTest {
    private final UiDevice device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
    private final String fixture = "BareGPS-native-workflow.gpx";
    private final String output = "BareGPS-native-output-" + System.currentTimeMillis() + ".gpx";
    private UiObject2 object(String text) {
        UiObject2 result = device.findObject(By.text(text));
        return result != null ? result : device.findObject(By.desc(text));
    }
    private UiObject2 find(String text) throws Exception {
        for (int i = 0; i < 9; i++) {
            UiObject2 result = object(text);
            if (result != null && result.getVisibleBounds().height() > 0) return result;
            device.swipe(device.getDisplayWidth() * 95 / 100, device.getDisplayHeight() * 80 / 100,
                device.getDisplayWidth() * 95 / 100, device.getDisplayHeight() * 30 / 100, 35);
            device.waitForIdle();
        }
        java.io.ByteArrayOutputStream tree = new java.io.ByteArrayOutputStream();
        device.dumpWindowHierarchy(tree);
        fail("Missing control: " + text + "\n" + tree.toString("UTF-8"));
        return null;
    }
    private void tap(String text) throws Exception {
        String id;
        switch(text) {
          case "Edit Existing": id="edit-tab"; break;
          case "Open GPX file(s)": case "Open files": id="import"; break;
          case "Reverse": id="reverse"; break;
          case "Add to Route Plan": id="add-route"; break;
          case "Confirm Route": id="confirm-route-plan"; break;
          case "Save Route": id="create-save"; break;
          case "Expand Route Card": case "Collapse Route Card": id="expand-card"; break;
          case "Share Text": id="create-share"; break;
          case "Share PDF": id="create-pdf"; break;
          default: throw new AssertionError("Unknown web control: "+text);
        }
        onWebView().withElement(findElement(Locator.ID,id)).perform(webScrollIntoView()).perform(webClick());
        device.waitForIdle();
    }
    private void top() {
        for (int i=0; i<5; i++) device.swipe(device.getDisplayWidth()*95/100,device.getDisplayHeight()*30/100,
            device.getDisplayWidth()*95/100,device.getDisplayHeight()*80/100,25);
    }
    private void openFiles() throws Exception { tap("Open files"); }
    private void nativeClick(BySelector selector) {
        for (int attempt=0; attempt<5; attempt++) {
            try {
                device.waitForIdle();
                UiObject2 control=device.wait(Until.findObject(selector),5000);
                assertNotNull("Native control: "+selector,control);
                control.click(); device.waitForIdle(); return;
            } catch (StaleObjectException stale) { if (attempt==4) throw stale; }
        }
    }
    private void downloads() throws Exception {
        UiObject2 roots = device.wait(Until.findObject(By.desc("Show roots")), 3000);
        if (roots != null) nativeClick(By.desc("Show roots"));
        if (device.wait(Until.hasObject(By.text("Downloads")),3000)) nativeClick(By.text("Downloads"));
        device.waitForIdle();
    }
    private void importFile(String name) throws Exception {
        openFiles(); downloads();
        UiObject2 file = device.wait(Until.findObject(By.text(name)), 10000);
        assertNotNull("Fixture/output must be in Downloads: " + name, file);
        file.click(); device.waitForIdle();
        UiObject2 open = object("Open");
        if (open != null && !device.getCurrentPackageName().contains("nativetest")) open.click();
        assertTrue("Return from system import picker", device.wait(Until.hasObject(By.pkg("com.baregps.trackeditor.nativetest")),10000));
    }
    private UiObject2 saveButton() {
        UiObject2 save = device.wait(Until.findObject(By.text("SAVE")), 5000);
        return save != null ? save : device.findObject(By.text("Save"));
    }
    @Test public void systemFilesRoundTripAndSharingCancellation() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("Protect real workspace: use prepare-native-tests.py", "com.baregps.trackeditor.nativetest", context.getPackageName());
        Intent intent=context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        assertNotNull(intent); intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK|Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent); device.waitForIdle();
        tap("Edit Existing");
        openFiles();
        assertNotNull("Native file picker opens",device.wait(Until.findObject(By.desc("Show roots")),10000));
        device.pressBack(); device.waitForIdle();
        onWebView().withElement(findElement(Locator.ID,"import")).check(webMatches(getText(), containsString("Open files")));
        importFile(fixture);
        tap("Reverse");
        tap("Add to Route Plan");
        tap("Confirm Route");
        assertTrue("Five complete elevations require no terrain service", device.wait(Until.gone(By.text("Confirm Route")),15000));
        tap("Save Route");
        assertNotNull("Native export picker opens",saveButton());
        device.pressBack(); device.waitForIdle();
        tap("Save Route"); downloads();
        UiObject2 filename=device.findObject(By.clazz("android.widget.EditText"));
        assertNotNull("Export filename field",filename); filename.setText(output);
        UiObject2 save=saveButton(); assertNotNull("System save action",save); save.click();
        assertTrue(device.wait(Until.hasObject(By.pkg(context.getPackageName())),10000));
        String xml=device.executeShellCommand("cat /sdcard/Download/"+output);
        Document doc=DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
        NodeList points=doc.getElementsByTagName("trkpt"); assertEquals(5,points.getLength());
        assertEquals("56.004",((Element)points.item(0)).getAttribute("lat"));
        assertEquals("56",((Element)points.item(4)).getAttribute("lat"));
        assertEquals("200",((Element)points.item(0)).getElementsByTagName("ele").item(0).getTextContent());
        assertEquals("Finish",((Element)points.item(0)).getElementsByTagName("name").item(0).getTextContent());
        tap("Expand Route Card");
        tap("Share Text");
        assertTrue("System text chooser opens",device.wait(Until.gone(By.pkg(context.getPackageName())),10000));
        device.pressBack(); device.waitForIdle();
        tap("Share PDF");
        assertTrue("System PDF chooser opens",device.wait(Until.gone(By.pkg(context.getPackageName())),10000));
        device.pressBack(); device.waitForIdle(); tap("Collapse Route Card");
        importFile(output);
        onWebView().withElement(findElement(Locator.XPATH,"//button[@aria-label='Remove Edited Route']")).check(webMatches(getText(), containsString("")));
        System.out.println("NATIVE_WORKFLOW_PASS output=/sdcard/Download/"+output+" points=5 reversed=true heights=true names=true");
    }
}
