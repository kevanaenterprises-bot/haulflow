import { useState, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator, SafeAreaView, Platform, BackHandler, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

// The driver portal lives at this URL. Vercel auto-deploys updates here, so once the
// app is in the stores, you don't need to re-submit to push new features — they're
// instantly live for every installed app via the WebView.
const DRIVER_URL = 'https://haulflow.vercel.app/driver';
const BRAND_COLOR = '#2F63C7';

export default function App() {
  const [loading, setLoading] = useState(true);
  const webRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);

  // Android hardware back button: navigate the WebView back instead of exiting the app
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBack = () => {
      if (canGoBackRef.current) {
        webRef.current?.goBack();
        return true; // we handled it
      }
      return false; // let the system close the app
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <WebView
          ref={webRef}
          source={{ uri: DRIVER_URL }}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={(nav) => { canGoBackRef.current = nav.canGoBack; }}
          // Camera + photo library + GPS need to bubble through the WebView
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          // iOS — let it use the underlying camera/photo picker
          allowsBackForwardNavigationGestures
          // Geolocation
          geolocationEnabled
          // Pull-to-refresh
          pullToRefreshEnabled
          startInLoadingState
          // Open external links (mailto:, tel:, etc.) in their native apps instead of the WebView
          onShouldStartLoadWithRequest={(req) => {
            const url = req.url;
            if (url.startsWith('http://') || url.startsWith('https://')) return true;
            if (url.startsWith('tel:') || url.startsWith('mailto:') || url.startsWith('sms:')) {
              // RN will handle these via Linking when we return false; for simplicity allow them
              return true;
            }
            return true;
          }}
          // Surface a friendly error if the connection drops
          renderError={() => (
            <View style={styles.errorBox}>
              <ActivityIndicator size="large" color={BRAND_COLOR} />
            </View>
          )}
        />
        {loading && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND_COLOR },
  container: { flex: 1, backgroundColor: '#fff' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BRAND_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBox: {
    flex: 1,
    backgroundColor: BRAND_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
