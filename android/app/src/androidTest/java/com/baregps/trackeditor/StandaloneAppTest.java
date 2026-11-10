package com.baregps.trackeditor;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.assertEquals;
@RunWith(AndroidJUnit4.class)
public class StandaloneAppTest {
 @Test public void standaloneIdentity() {
  assertEquals("com.baregps.trackeditor", InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName());
 }
}
