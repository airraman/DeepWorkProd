// src/components/modals/BaseModal.js
import React from 'react';
import {
    Modal,
    View,
    TouchableOpacity,
    StyleSheet,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Dimensions
} from 'react-native';
import { X } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');
const isTablet = width > 768 || height > 768;

const BaseModal = ({ visible, onClose, children }) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <Pressable 
                    style={styles.backdropPressable} 
                    onPress={onClose}
                >
                    <View 
                        style={styles.modalContent}
                    >
                        <TouchableOpacity 
                            style={styles.closeButton}
                            onPress={onClose}
                            accessible={true}
                            accessibilityLabel="Close modal"
                        >
                            <X size={24} color="#6b7280" />
                        </TouchableOpacity>
                        <View style={styles.childrenContainer}>
                            {children}
                        </View>
                    </View>
                </Pressable>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdropPressable: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 12,
        width: isTablet ? '80%' : '85%',
        maxWidth: isTablet ? 500 : 350,
        minHeight: 200,
        maxHeight: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        position: 'relative',
    },
    childrenContainer: {
        padding: 20,
        paddingTop: 40, // Make room for the close button
    },
    closeButton: {
        position: 'absolute',
        right: 10,
        top: 10,
        zIndex: 10,
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(229, 231, 235, 0.5)',
    }
});

export default BaseModal;