// scripts/patch-manifest.js
import fs from 'fs';
import path from 'path';

const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');

if (!fs.existsSync(manifestPath)) {
  console.log('⚠️ AndroidManifest.xml not found yet. Skipping manifest patch.');
  process.exit(0);
}

try {
  let manifestContent = fs.readFileSync(manifestPath, 'utf8');
  
  const permissionString = '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />;';

  if (manifestContent.includes('android.permission.REQUEST_INSTALL_PACKAGES')) {
    console.log('✅ REQUEST_INSTALL_PACKAGES permission already exists in AndroidManifest.xml');
    process.exit(0);
  }

  // Insert the permission right before the <application> tag
  if (manifestContent.includes('<application')) {
    manifestContent = manifestContent.replace(
      '<application',
      `    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />\n    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />\n<application`
    );
    
    fs.writeFileSync(manifestPath, manifestContent, 'utf8');
    console.log('🚀 Successfully injected installer permissions into AndroidManifest.xml');
  } else {
    console.error('❌ Could not find <application> tag in AndroidManifest.xml');
  }
} catch (err) {
  console.error('❌ Failed to patch AndroidManifest.xml:', err);
  process.exit(1);
}
