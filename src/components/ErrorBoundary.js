// src/components/ErrorBoundary.js
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      deviceInfo: {
        platform: Platform.OS,
        version: Platform.Version,
        isTablet: Platform.isPad || false, // iPad detection
      }
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // In production, you'd send this to a crash reporting service
    // crashlytics().recordError(error);
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI for crashes
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.title}>App Error Detected</Text>
            <Text style={styles.subtitle}>
              Something went wrong. Here are the details:
            </Text>
            
            <View style={styles.deviceInfo}>
              <Text style={styles.sectionTitle}>Device Information:</Text>
              <Text style={styles.infoText}>
                Platform: {this.state.deviceInfo.platform}
              </Text>
              <Text style={styles.infoText}>
                Version: {this.state.deviceInfo.version}
              </Text>
              <Text style={styles.infoText}>
                Is Tablet: {this.state.deviceInfo.isTablet ? 'Yes' : 'No'}
              </Text>
            </View>

            {this.state.error && (
              <View style={styles.errorSection}>
                <Text style={styles.sectionTitle}>Error:</Text>
                <Text style={styles.errorText}>
                  {this.state.error.toString()}
                </Text>
              </View>
            )}

            {this.state.errorInfo && (
              <View style={styles.errorSection}>
                <Text style={styles.sectionTitle}>Stack Trace:</Text>
                <Text style={styles.stackTrace}>
                  {this.state.errorInfo.componentStack}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  scrollContent: {
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 20,
    textAlign: 'center',
  },
  deviceInfo: {
    backgroundColor: '#e9ecef',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#495057',
  },
  infoText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 5,
  },
  errorSection: {
    backgroundColor: '#f8d7da',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  errorText: {
    fontSize: 14,
    color: '#721c24',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  stackTrace: {
    fontSize: 12,
    color: '#721c24',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});

export default ErrorBoundary;