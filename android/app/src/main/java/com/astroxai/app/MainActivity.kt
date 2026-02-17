package com.astroxai.app

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.CookieManager
import android.webkit.WebStorage
import android.widget.FrameLayout
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

  private lateinit var webView: WebView
  private var popupWebView: WebView? = null
  private lateinit var popupContainer: FrameLayout

  // This is the URL the WebView loads.
  // With `adb reverse tcp:5173 tcp:5173`, the phone's 127.0.0.1:5173 maps to your PC's 5173.
  private val startUrl = "http://127.0.0.1:5173"

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    // Initialize popup container after setContentView
    popupContainer = FrameLayout(this)
    addContentView(popupContainer, FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT,
      FrameLayout.LayoutParams.MATCH_PARENT
    ))

    val progress = findViewById<View>(R.id.progress)
    webView = findViewById(R.id.webView)

    webView.settings.apply {
      javaScriptEnabled = true
      domStorageEnabled = true
      databaseEnabled = true
      cacheMode = WebSettings.LOAD_DEFAULT
      mediaPlaybackRequiresUserGesture = false
      mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
      // Set a standard browser user agent to comply with Google's "Use secure browsers" policy
      userAgentString = "Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

      // Allow third-party cookies for Google OAuth
      @SuppressLint("WrongConstant")
      val cookieManager = CookieManager.getInstance()
      cookieManager.setAcceptThirdPartyCookies(webView, true)
      cookieManager.setAcceptCookie(true)

      // Allow popups (OAuth often opens a popup)
      javaScriptCanOpenWindowsAutomatically = true
      setSupportMultipleWindows(true)
    }

    webView.webViewClient = object : WebViewClient() {
      override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
        progress.visibility = View.VISIBLE
      }

      override fun onPageFinished(view: WebView?, url: String?) {
        progress.visibility = View.GONE
      }

      override fun onReceivedError(
        view: WebView?,
        request: WebResourceRequest?,
        error: WebResourceError?
      ) {
        // Keep default behavior; troubleshooting section covers how to debug.
        super.onReceivedError(view, request, error)
      }
    }

    webView.webChromeClient = object : WebChromeClient() {
      override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
        // Useful for debugging in Logcat.
        return super.onConsoleMessage(consoleMessage)
      }

      // Handle OAuth popups by creating a new WebView
      override fun onCreateWindow(
        view: WebView?,
        isDialog: Boolean,
        isUserGesture: Boolean,
        resultMsg: android.os.Message?
      ): Boolean {
        resultMsg?.let { msg ->
          val newWebView = WebView(this@MainActivity).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.javaScriptCanOpenWindowsAutomatically = true
            settings.setSupportMultipleWindows(true)
            
            // Enable cookies for OAuth
            val cookieManager = CookieManager.getInstance()
            cookieManager.setAcceptCookie(true)
            cookieManager.setAcceptThirdPartyCookies(this, true)
            
            // Set standard user agent for popup as well
            settings.userAgentString = "Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
            
            webViewClient = object : WebViewClient() {
              override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
              }
              
              override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Check if this is a Google OAuth redirect back to our app
                if (url?.contains("127.0.0.1:5173") == true) {
                  // Close popup and load the URL in main WebView
                  closePopup()
                  webView.loadUrl(url)
                }
              }
            }
          }
          
          popupWebView = newWebView
          popupContainer.addView(newWebView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
          ))
          popupContainer.visibility = View.VISIBLE
          
          val transport = msg.obj as WebView.WebViewTransport
          transport.webView = newWebView
          msg.sendToTarget()
          
          return true
        }
        return false
      }
      
      override fun onCloseWindow(window: WebView?) {
        closePopup()
        super.onCloseWindow(window)
      }
    }

    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        when {
          popupContainer.visibility == View.VISIBLE -> closePopup()
          webView.canGoBack() -> webView.goBack()
          else -> finish()
        }
      }
    })

    if (savedInstanceState == null) {
      webView.loadUrl(startUrl)
    } else {
      webView.restoreState(savedInstanceState)
    }
  }

  override fun onSaveInstanceState(outState: Bundle) {
    super.onSaveInstanceState(outState)
    webView.saveState(outState)
  }
  
  private fun closePopup() {
    popupWebView?.let { popup ->
      popupContainer.removeView(popup)
      popup.destroy()
      popupWebView = null
    }
    popupContainer.visibility = View.GONE
  }
}
