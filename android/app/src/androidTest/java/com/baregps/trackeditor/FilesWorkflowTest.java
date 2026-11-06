package com.baregps.trackeditor;

import android.content.Context;
import android.content.Intent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class FilesWorkflowTest {
    private final UiDevice device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
    private void launch() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK | Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
        assertTrue(device.wait(Until.hasObject(By.text("Open GPX files")), 20000));
    }
    private UiObject2 waitText(String text) {
        UiObject2 result = device.wait(Until.findObject(By.text(text)), 15000);
        assertNotNull("Expected text: " + text, result); return result;
    }
    private void click(BySelector selector) {
        for(int attempt=0;attempt<5;attempt++) {
            UiObject2 target=device.wait(Until.findObject(selector),10000);
            assertNotNull("Expected control: "+selector,target);
            try { target.click();return; } catch(StaleObjectException error) { if(attempt==4)throw error; }
        }
    }
    @Test public void importCancelAndSaveUsingSystemFiles() throws Exception {
        launch(); waitText("Open GPX files").click();
        assertTrue(device.wait(Until.hasObject(By.pkg("com.android.documentsui")), 15000));
        device.pressBack();
        assertTrue(device.wait(Until.hasObject(By.text("Open GPX files").enabled(true)), 10000));
        waitText("Open GPX files").click();
        UiObject2 menu = device.wait(Until.findObject(By.desc("Show roots")), 10000);
        if (menu != null) click(By.desc("Show roots"));
        UiObject2 downloads = device.wait(Until.findObject(By.text("Downloads")), 5000);
        if (downloads != null) click(By.text("Downloads"));
        UiObject2 fixture = device.wait(Until.findObject(By.textContains("Native fixture")), 10000);
        assertNotNull("Native fixture.gpx must be in the emulator Downloads folder", fixture);
        for(int attempt=0;attempt<4;attempt++) {
            try { device.waitForIdle();device.wait(Until.findObject(By.textContains("Native fixture")),10000).click();break; }
            catch(StaleObjectException e) { if(attempt==3)throw e; }
        }
        assertTrue(device.wait(Until.hasObject(By.pkg("com.baregps.trackeditor")), 15000));
        UiObject2 dismiss=device.wait(Until.findObject(By.text("Dismiss message")),5000);
        if(dismiss==null)dismiss=device.findObject(By.desc("Dismiss message"));
        if(dismiss!=null)dismiss.click();
        UiObject2 save = null;
        for(int i=0;i<8;i++) {
            save=device.findObject(By.text("Save section"));if(save!=null && save.getVisibleBounds().height()>20 && save.getVisibleBounds().top>device.getDisplayHeight()/5)break;save=null;
            device.swipe(device.getDisplayWidth()/2,device.getDisplayHeight()*4/5,device.getDisplayWidth()/2,device.getDisplayHeight()/3,35);
        }
        assertNotNull("Imported track should expose Save section", save); save.click();
        UiObject2 saveFile=device.wait(Until.findObject(By.text("SAVE")),10000);
        if(saveFile==null)saveFile=device.wait(Until.findObject(By.text("Save")),3000);
        if(saveFile==null) {java.io.ByteArrayOutputStream hierarchy=new java.io.ByteArrayOutputStream();device.dumpWindowHierarchy(hierarchy);System.out.println(hierarchy.toString("UTF-8"));}
        assertNotNull("Native create-document dialog should have Save",saveFile);saveFile.click();
        assertTrue(device.wait(Until.hasObject(By.textContains("GPX saved to your chosen location")),15000));
        // Exercise the same incoming-document handoff used by the Files app.
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        java.io.File handoff=new java.io.File(context.getCacheDir(),"handoff.gpx");
        String gpx="<gpx version=\"1.1\"><trk><name>Handoff test</name><trkseg><trkpt lat=\"57\" lon=\"-5\"><ele>10</ele></trkpt><trkpt lat=\"57.001\" lon=\"-5\"><ele>30</ele></trkpt></trkseg></trk></gpx>";
        try(java.io.FileOutputStream output=new java.io.FileOutputStream(handoff)){output.write(gpx.getBytes(java.nio.charset.StandardCharsets.UTF_8));}
        android.net.Uri uri=androidx.core.content.FileProvider.getUriForFile(context,context.getPackageName()+".fileprovider",handoff);
        Intent incoming=new Intent(Intent.ACTION_VIEW,uri,context,MainActivity.class);
        incoming.setDataAndType(uri,"application/gpx+xml");
        incoming.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_GRANT_READ_URI_PERMISSION);
        context.startActivity(incoming);
        assertTrue(device.wait(Until.hasObject(By.textContains("Handoff test")),15000));

    }
}
