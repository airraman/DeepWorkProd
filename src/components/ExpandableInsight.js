// src/components/ExpandableInsight.js

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * ExpandableInsight Component
 * 
 * Shows a truncated preview of insight text. When tapped, opens a modal
 * with the full insight text. Uses onTextLayout to detect if truncation occurred.
 * 
 * Props:
 * - insight: Object with { insightText, metadata }
 * - title: String for the insight type (e.g., "Weekly Insight")
 */
const ExpandableInsight = ({ insight, title = "Insight" }) => {
  const { colors } = useTheme();
  
  const [modalVisible, setModalVisible] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  
  /**
   * onTextLayout is called after the native text layout calculation completes.
   * It provides information about how the text was rendered, including line count.
   * 
   * We use this to detect if the text was truncated (has more than 3 lines).
   */
  const handleTextLayout = (e) => {
    const { lines } = e.nativeEvent;
    
    // If the text naturally has more than 3 lines, it was truncated
    // because we set numberOfLines={3}
    if (lines.length > 3) {
      setIsTruncated(true);
    }
  };
  
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };
  
  return (
    <>
      {/* TRUNCATED PREVIEW */}
      <View style={[styles.insightSection, { 
        backgroundColor: colors.cardBackground,
        borderColor: colors.border,
      }]}>
        <View style={styles.insightHeader}>
          <Text style={[styles.insightTitle, { color: colors.text }]}>
            {title}
          </Text>
          <Text style={[styles.insightMeta, { color: colors.textSecondary }]}>
            {insight.metadata.fromCache ? '📦' : '✨'}{' '}
            {formatDate(insight.metadata.generatedAt)}
          </Text>
        </View>
        
        {/* 
          TouchableOpacity wraps the text to make the entire preview tappable.
          This is better UX than requiring users to find a small "Read more" button.
        */}
        <TouchableOpacity 
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text 
            style={[styles.insightText, { color: colors.text }]}
            numberOfLines={3}
            onTextLayout={handleTextLayout}
          >
            {insight.insightText}
          </Text>
          
          {/* Show "Read more" indicator if text was truncated */}
          {isTruncated && (
            <Text style={[styles.readMoreText, { color: colors.primary }]}>
              Read more →
            </Text>
          )}
        </TouchableOpacity>
      </View>
      
      {/* FULL TEXT MODAL */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { 
          backgroundColor: colors.background 
        }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { 
            borderBottomColor: colors.border 
          }]}>
            <View style={styles.modalTitleContainer}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {title}
              </Text>
              <Text style={[styles.modalMeta, { color: colors.textSecondary }]}>
                {insight.metadata.fromCache ? 'Cached' : 'Fresh'} • {' '}
                {formatDate(insight.metadata.generatedAt)}
              </Text>
            </View>
            
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.cardBackground }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.closeButtonText, { color: colors.text }]}>✕</Text>
            </TouchableOpacity>
          </View>
          
          {/* Scrollable Full Content */}
          <ScrollView 
            style={styles.modalContent}
            contentContainerStyle={styles.modalContentContainer}
          >
            <Text style={[styles.modalInsightText, { color: colors.text }]}>
              {insight.insightText}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // ================================================================
  // PREVIEW STYLES (Truncated view)
  // ================================================================
  insightSection: {
    padding: 12,           // Reduced from 16
    marginHorizontal: 1,
    marginTop: 1,          // Reduced from 16
    marginBottom: 1,       // Reduced from 14
    borderRadius: 12,
    borderWidth: 1,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  insightMeta: {
    fontSize: 12,
  },
  insightText: {
    fontSize: 14,          // Reduced from 15
    lineHeight: 20,        // Reduced from 22
  },
  readMoreText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  
  // ================================================================
  // MODAL STYLES (Full view)
  // ================================================================
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalMeta: {
    fontSize: 13,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 20,
  },
  modalInsightText: {
    fontSize: 16,
    lineHeight: 26,
  },
});

export default ExpandableInsight;