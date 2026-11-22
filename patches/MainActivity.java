package com.rabbittv.app;

import android.content.ActivityNotFoundException;
import android.content.ComponentCallbacks2;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeWebViewClient;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class MainActivity extends BridgeActivity {
    private View customView;
    private FrameLayout fullscreenContainer;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private Bitmap transparentPoster;

    // Exact / root domains that must NEVER be blocked by the native ad firewall
    private static final Set<String> SAFE_WHITELIST_DOMAINS = new HashSet<>(Arrays.asList(
        "localhost",
        "127.0.0.1",
        "vidsrc.to",
        "vidsrc.xyz",
        "vidsrc.me",
        "vidsrc.in",
        "vidsrc.pm",
        "vidsrc.net",
        "vidsrc.cc",
        "vidsrc.icu",
        "vidsrc.pro",
        "vidsrc.su",
        "vidsrcme.ru",
        "vsembed.ru",
        "cloudnestra.com",
        "vidlink.pro",
        "videasy.net",
        "player.videasy.net",
        "autoembed.cc",
        "vidfast.pro",
        "challenges.cloudflare.com",
        "cloudflare.com",
        "themoviedb.org",
        "tmdb.org",
        "github.com",
        "githubusercontent.com",
        "api.github.com",
        "mjh.nz",
        "jsdelivr.net",
        "youtube.com",
        "youtube-nocookie.com",
        "ytimg.com",
        "googlevideo.com",
        "imdb.com",
        "unsplash.com",
        "musicradio.com",
        "somafm.com",
        "walmradio.com",
        "dar.fm",
        "streamingmedia.it",
        "dancewave.online",
        "1.fm",
        "10play.com.au",
        "10.com.au",
        "sbsod.com",
        "abc.net.au",
        "abc-cdn.net.au",
        "skyone.co.nz",
        "static9.net.au",
        "dw.com",
        "mncdn.com"
    ));

    // High-confidence ad, popunder, clickunder, push-scam, and overlay networks
    // Intercepted natively even inside cross-origin vidsrc iframes
    private static final Set<String> BLOCKED_AD_DOMAINS = new HashSet<>(Arrays.asList(
        "doubleclick.net",
        "googleadservices.com",
        "googlesyndication.com",
        "google-analytics.com",
        "googletagmanager.com",
        "googletagservices.com",
        "adservice.google.com",
        "popads.net",
        "popcash.net",
        "adcash.com",
        "juicyads.com",
        "exoclick.com",
        "exosrv.com",
        "exdynsrv.com",
        "propellerads.com",
        "propellerclick.com",
        "monetag.com",
        "adnxs.com",
        "adsrvr.org",
        "advertising.com",
        "adform.net",
        "outbrain.com",
        "taboola.com",
        "revcontent.com",
        "mgid.com",
        "zedo.com",
        "adblade.com",
        "adsterra.com",
        "clickadu.com",
        "hilltopads.com",
        "trafficjunky.com",
        "trafficjunky.net",
        "trafficstars.com",
        "pushnami.com",
        "pushengage.com",
        "onesignal.com",
        "acscdn.com",
        "onclasrv.com",
        "realsrv.com",
        "magsrv.com",
        "tsyndicate.com",
        "galaksion.com",
        "rollerads.com",
        "richads.com",
        "evadav.com",
        "adskeeper.com",
        "bidgear.com",
        "bidvertiser.com",
        "clksite.com",
        "trwl1.com",
        "notix.io",
        "pushwhy.com",
        "dtscout.com",
        "histats.com",
        "admaven.com",
        "adspyglass.com",
        "clickaine.com",
        "popmyads.com",
        "plugrush.com",
        "pushhouse.com",
        "kadam.net",
        "zeropark.com",
        "wpadmngr.com",
        "highperformanceformat.com",
        "topcreativeformat.com",
        "profitablegate.com",
        "effectivegatecpm.com",
        "alwingulla.com",
        "al5sm.com",
        "fpyf8.com",
        "bvtpk.com",
        "dolohen.com",
        "goomaphy.com",
        "thaudray.com",
        "inpagepush.com",
        "pushub.net",
        "a-ads.com",
        "bet365.com",
        "1xbet.com",
        "poperblocker.com",
        "syndication.realsrv.com",
        "syndication.exdynsrv.com",
        "s.magsrv.com",
        "mc.yandex.ru",
        "yandex.ru",
        "scorecardresearch.com",
        "quantserve.com",
        "criteo.com",
        "criteo.net",
        "pubmatic.com",
        "rubiconproject.com",
        "openx.net",
        "amazon-adsystem.com",
        "clarity.ms",
        "hotjar.com",
        "sentry.io",
        "bugsnag.com",
        "newrelic.com"
    ));

    // Strict ad-only hostname keywords (safe: won't false-positive on Live TV or CDNs)
    private static final String[] BLOCKED_HOST_KEYWORDS = new String[] {
        "popunder",
        "popads",
        "popcash",
        "adcash",
        "juicyads",
        "exoclick",
        "propeller",
        "clickunder",
        "monetag",
        "adsterra",
        "hilltopads",
        "trafficjunky",
        "trafficstars",
        "acscdn",
        "onclasrv",
        "realsrv",
        "magsrv",
        "tsyndicate",
        "galaksion",
        "rollerads",
        "evadav",
        "adskeeper",
        "adserver",
        "admaven",
        "adspyglass",
        "clickaine",
        "inpagepush",
        "wpadmngr",
        "profitablegate",
        "effectivegate",
        "doubleclick",
        "googlesyndication",
        "googleadservices",
        "bet365",
        "1xbet",
        "poperblocker",
        "popmyads",
        "plugrush",
        "pushnami",
        "pushengage",
        "onesignal"
    };

    // High-confidence ad script paths blocked on non-whitelisted third-party hosts
    private static final String[] BLOCKED_SCRIPT_PATHS = new String[] {
        "/popunder",
        "/clickunder",
        "/inpagepush",
        "/aclib",
        "/pop.js",
        "/pops.js",
        "/ads.js",
        "/adbanner",
        "/adblock-detect",
        "/prebid.js",
        "betterjspop"
    };

    @Override
    @SuppressWarnings("deprecation")
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep the screen awake during playback across TVs, sticks, and projectors
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        if (this.bridge == null || this.bridge.getWebView() == null) {
            return;
        }

        final WebView webView = this.bridge.getWebView();

        // Dark launch background eliminates white flash on Android TV / Fire TV
        webView.setBackgroundColor(Color.parseColor("#050b16"));
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        // Ensure video CDNs & embed players (Vidsrc, VidLink, Videasy) can store third-party cookies
        configureWebViewCookies(webView);

        // Hardened WebView settings tuned for streaming + low-RAM sticks
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setGeolocationEnabled(false);
        settings.setAllowContentAccess(true); // Preserves <input type="file"> for JSON backup import
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Allows http:// lobby radio stations to play smoothly inside https://localhost app
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }

        // CRITICAL: Routes window.open() & target="_blank" to onCreateWindow instead of escaping to Chrome/Silk
        settings.setSupportMultipleWindows(true);

        // 1. Native Network & Redirect Ad Firewall (Extends Capacitor BridgeWebViewClient)
        webView.setWebViewClient(new BridgeWebViewClient(this.bridge) {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (request == null || request.getUrl() == null) {
                    return super.shouldInterceptRequest(view, request);
                }

                Uri uri = request.getUrl();
                String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase(Locale.US) : "";
                if (!"http".equals(scheme) && !"https".equals(scheme)) {
                    return super.shouldInterceptRequest(view, request);
                }

                String host = uri.getHost() != null ? uri.getHost().toLowerCase(Locale.US) : "";
                String fullUrl = uri.toString().toLowerCase(Locale.US);

                // Always allow our local Capacitor app and core whitelisted hosts immediately
                if (host.isEmpty() || isHostWhitelisted(host)) {
                    return super.shouldInterceptRequest(view, request);
                }

                // Block ad/popunder/overlay networks BEFORE they execute inside cross-origin iframes!
                if (isBlockedAdHost(host)) {
                    return createBlockedResponse(fullUrl);
                }

                // Never interfere with actual video/audio/subtitle media streams on CDN hosts
                if (isMediaStreamResource(fullUrl)) {
                    return super.shouldInterceptRequest(view, request);
                }

                // Block high-confidence popunder/overlay script paths on unknown third-party hosts
                if (hasBlockedScriptPath(fullUrl)) {
                    return createBlockedResponse(fullUrl);
                }

                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request == null || request.getUrl() == null) {
                    return true;
                }

                Uri uri = request.getUrl();
                String rawUrl = uri.toString();
                String lowerUrl = rawUrl.toLowerCase(Locale.US);
                String host = uri.getHost() != null ? uri.getHost().toLowerCase(Locale.US) : "";

                // Always block dangerous redirect schemes and store hijacks
                if (lowerUrl.startsWith("intent://") ||
                    lowerUrl.startsWith("market://") ||
                    lowerUrl.startsWith("vnd.youtube:") ||
                    lowerUrl.startsWith("javascript:") ||
                    lowerUrl.startsWith("blob:") ||
                    lowerUrl.startsWith("data:")) {
                    return true;
                }

                // Always allow local Capacitor app routing
                if ("localhost".equals(host) || "127.0.0.1".equals(host)) {
                    return super.shouldOverrideUrlLoading(view, request);
                }

                // Always kill ad-network redirect attempts on both main frame and iframes
                if (isBlockedAdHost(host) || hasBlockedScriptPath(lowerUrl)) {
                    return true;
                }

                // Allow intentional trusted external links (GitHub APK updates, IMDb, WhatsApp, tel/sms)
                if (isTrustedExternalAction(lowerUrl)) {
                    openExternalSafely(rawUrl);
                    return true;
                }

                // Sub-frames (e.g. vidsrc cookie gate & internal player mirror hops):
                // Return false directly so Android WebView loads inside the iframe instead of
                // letting Capacitor's BridgeWebViewClient hijack it as an external Intent!
                if (!request.isForMainFrame()) {
                    return false;
                }

                // Main frame: block all unknown external escape redirects on TVs, boxes, and projectors
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                flushCookiesSafely();
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // Prevents hard crash to Android TV home screen if a heavy stream exhausts RAM on a 1-2GB stick
                try {
                    cleanupCustomView();
                    if (view != null) {
                        view.reload();
                        return true;
                    }
                } catch (Exception ignored) {
                    // Fall through to default behavior if reload fails
                }
                return super.onRenderProcessGone(view, detail);
            }
        });

        // 2. Hardened Chrome Client (Extends Capacitor BridgeWebChromeClient to preserve file pickers)
        webView.setWebChromeClient(new BridgeWebChromeClient(this.bridge) {
            @Override
            public Bitmap getDefaultVideoPoster() {
                // Eliminates Android TV 14's giant grey default play icon across all <video> elements
                if (transparentPoster == null || transparentPoster.isRecycled()) {
                    transparentPoster = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
                    transparentPoster.eraseColor(Color.TRANSPARENT);
                }
                return transparentPoster;
            }

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                // Allow only intentional user clicks on trusted external links (GitHub APK, IMDb, WhatsApp)
                if (isUserGesture && view != null) {
                    WebView.HitTestResult hit = view.getHitTestResult();
                    if (hit != null && hit.getExtra() != null) {
                        String tappedUrl = hit.getExtra();
                        if (isTrustedExternalAction(tappedUrl.toLowerCase(Locale.US))) {
                            openExternalSafely(tappedUrl);
                        }
                    }
                }

                // Swallow all ad popups / popunders completely so Chrome or Silk never launches
                if (resultMsg != null && resultMsg.obj instanceof WebView.WebViewTransport) {
                    WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                    transport.setWebView(null);
                    resultMsg.sendToTarget();
                }
                return true;
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                if (request == null) return;
                String[] resources = request.getResources();
                if (resources != null) {
                    for (String res : resources) {
                        // Allow Widevine Protected Media DRM (needed for TVNZ / .mpd Live TV feeds)
                        if (PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID.equals(res)) {
                            runOnUiThread(() -> {
                                try {
                                    request.grant(new String[] { PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID });
                                } catch (Exception ignored) {
                                    request.deny();
                                }
                            });
                            return;
                        }
                    }
                }
                // Deny rogue Notification, Camera, Microphone, or Location prompts from third-party embeds
                request.deny();
            }

            @Override
            public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                if (!isLocalAppOrigin(url)) {
                    if (result != null) result.cancel();
                    return true;
                }
                return super.onJsAlert(view, url, message, result);
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                if (!isLocalAppOrigin(url)) {
                    if (result != null) result.cancel();
                    return true;
                }
                return super.onJsConfirm(view, url, message, result);
            }

            @Override
            public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, JsPromptResult result) {
                if (!isLocalAppOrigin(url)) {
                    if (result != null) result.cancel();
                    return true;
                }
                return super.onJsPrompt(view, url, message, defaultValue, result);
            }

            @Override
            public boolean onJsBeforeUnload(WebView view, String url, String message, JsResult result) {
                // Prevents ad scripts from trapping the user with "Leave site?" popups
                if (result != null) result.confirm();
                return true;
            }

            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                customView = view;
                customViewCallback = callback;

                getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                    View.SYSTEM_UI_FLAG_FULLSCREEN |
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                );

                fullscreenContainer = new FrameLayout(MainActivity.this);
                fullscreenContainer.setBackgroundColor(Color.BLACK);

                FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                );
                fullscreenContainer.addView(customView, params);

                addContentView(fullscreenContainer, new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                ));

                webView.setVisibility(View.GONE);
            }

            @Override
            public void onHideCustomView() {
                cleanupCustomView();
            }
        });
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        // Allow Escape key on air-mouse / keyboards to exit fullscreen video cleanly
        if (customView != null &&
            event.getAction() == KeyEvent.ACTION_UP &&
            event.getKeyCode() == KeyEvent.KEYCODE_ESCAPE) {
            cleanupCustomView();
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // 1. Exit fullscreen video if expanded
        if (customView != null) {
            cleanupCustomView();
            return;
        }

        // 2. Navigate back inside the SPA, suppressing accidental exit on Home ("/")
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.evaluateJavascript("window.location.pathname", path -> {
                if (path != null && (path.equals("\"/\"") || path.equals("/"))) {
                    return;
                }
                webView.evaluateJavascript("window.history.back()", null);
            });
        } else {
            super.onBackPressed();
        }
    }

    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        // Protect 1-2GB Fire TV / Android TV sticks from OOM kills by freeing WebView RAM cache
        if (level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW) {
            releaseWebViewRamSafely();
        }
    }

    @Override
    public void onLowMemory() {
        super.onLowMemory();
        releaseWebViewRamSafely();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (this.bridge != null && this.bridge.getWebView() != null) {
            configureWebViewCookies(this.bridge.getWebView());
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        flushCookiesSafely();
    }

    @Override
    public void onStop() {
        super.onStop();
        flushCookiesSafely();
    }

    @Override
    public void onDestroy() {
        cleanupCustomView();
        if (transparentPoster != null && !transparentPoster.isRecycled()) {
            transparentPoster.recycle();
            transparentPoster = null;
        }
        super.onDestroy();
    }

    // ──────────────────────────────────────────────────────────────
    // Helper Methods (Fast O(depth) Domain Matching & Safe Cleanup)
    // ──────────────────────────────────────────────────────────────

    private void configureWebViewCookies(WebView webView) {
        if (webView == null) return;
        try {
            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                cookieManager.setAcceptThirdPartyCookies(webView, true);
            }
            cookieManager.flush();
        } catch (Exception ignored) {
            // Ignore on restricted WebViews
        }
    }

    private void flushCookiesSafely() {
        try {
            CookieManager.getInstance().flush();
        } catch (Exception ignored) {
            // Ignore if CookieManager is unavailable
        }
    }

    private void releaseWebViewRamSafely() {
        if (this.bridge == null || this.bridge.getWebView() == null) return;
        runOnUiThread(() -> {
            try {
                WebView webView = this.bridge.getWebView();
                // false = clear RAM cache only (preserves disk cache & localStorage settings!)
                webView.clearCache(false);
                webView.evaluateJavascript(
                    "window.dispatchEvent(new Event('rabtv_native_low_memory'))",
                    null
                );
            } catch (Exception ignored) {
                // Ignore if WebView is already destroyed
            }
        });
    }

    private static boolean hostMatchesDomainSet(String host, Set<String> domainSet) {
        if (host == null || host.isEmpty()) return false;
        String current = host;
        while (current != null && !current.isEmpty()) {
            if (domainSet.contains(current)) {
                return true;
            }
            int dot = current.indexOf('.');
            if (dot < 0 || dot == current.length() - 1) {
                break;
            }
            current = current.substring(dot + 1);
        }
        return false;
    }

    private static boolean isHostWhitelisted(String host) {
        if (hostMatchesDomainSet(host, SAFE_WHITELIST_DOMAINS)) {
            return true;
        }
        return host.contains("vidsrc");
    }

    private static boolean isBlockedAdHost(String host) {
        if (host == null || host.isEmpty()) return false;
        if (hostMatchesDomainSet(host, BLOCKED_AD_DOMAINS)) {
            return true;
        }
        for (String kw : BLOCKED_HOST_KEYWORDS) {
            if (host.contains(kw)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isMediaStreamResource(String lowerUrl) {
        String pathOnly = lowerUrl;
        int qIdx = pathOnly.indexOf('?');
        if (qIdx >= 0) {
            pathOnly = pathOnly.substring(0, qIdx);
        }
        return pathOnly.endsWith(".m3u8") ||
               pathOnly.endsWith(".mpd") ||
               pathOnly.endsWith(".ts") ||
               pathOnly.endsWith(".mp4") ||
               pathOnly.endsWith(".m4s") ||
               pathOnly.endsWith(".m4a") ||
               pathOnly.endsWith(".webm") ||
               pathOnly.endsWith(".vtt") ||
               pathOnly.endsWith(".srt") ||
               pathOnly.endsWith(".aac") ||
               pathOnly.endsWith(".mp3") ||
               pathOnly.endsWith(".key");
    }

    private static boolean hasBlockedScriptPath(String lowerUrl) {
        for (String pattern : BLOCKED_SCRIPT_PATHS) {
            if (lowerUrl.contains(pattern)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isLocalAppOrigin(String url) {
        if (url == null) return false;
        String lower = url.toLowerCase(Locale.US);
        return lower.startsWith("http://localhost") ||
               lower.startsWith("https://localhost") ||
               lower.startsWith("capacitor://localhost");
    }

    private static boolean isTrustedExternalAction(String lowerUrl) {
        if (lowerUrl == null || lowerUrl.isEmpty()) return false;
        if (lowerUrl.startsWith("tel:") || lowerUrl.startsWith("sms:")) {
            return true;
        }
        if (lowerUrl.startsWith("whatsapp://") ||
            lowerUrl.contains("wa.me/") ||
            lowerUrl.contains("api.whatsapp.com")) {
            return true;
        }
        if (lowerUrl.contains("imdb.com/title/") || lowerUrl.contains("imdb.com/find")) {
            return true;
        }
        return (lowerUrl.contains("github.com/rogerskyle0506-ui/rabbit-tv-2.0") ||
                lowerUrl.contains("objects.githubusercontent.com") ||
                lowerUrl.contains("release-assets.githubusercontent.com") ||
                lowerUrl.contains("github-releases.githubusercontent.com")) &&
               (lowerUrl.contains("/releases/") || lowerUrl.contains(".apk"));
    }

    private void openExternalSafely(String rawUrl) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(rawUrl));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (ActivityNotFoundException | SecurityException ignored) {
            // Gracefully ignore on minimalist TV boxes without a browser/dialer
        }
    }

    private static WebResourceResponse createBlockedResponse(String lowerUrl) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Cache-Control", "no-store");

        boolean isJs = lowerUrl.contains(".js") || lowerUrl.contains("script");
        String mime = isJs ? "application/javascript" : "text/plain";
        byte[] body = (isJs ? "/* blocked */" : "").getBytes(StandardCharsets.UTF_8);

        return new WebResourceResponse(
            mime,
            "UTF-8",
            200,
            "OK",
            headers,
            new ByteArrayInputStream(body)
        );
    }

    @SuppressWarnings("deprecation")
    private void cleanupCustomView() {
        if (customView == null) {
            return;
        }
        getWindow().getDecorView().setSystemUiVisibility(0);

        if (fullscreenContainer != null && fullscreenContainer.getParent() instanceof ViewGroup) {
            ((ViewGroup) fullscreenContainer.getParent()).removeView(fullscreenContainer);
        }

        customView = null;
        fullscreenContainer = null;

        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setVisibility(View.VISIBLE);
        }

        if (customViewCallback != null) {
            customViewCallback.onCustomViewHidden();
            customViewCallback = null;
        }
    }
}
