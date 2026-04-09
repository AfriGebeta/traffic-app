import { TouchableOpacity, Text, StyleSheet, Share, Platform, Clipboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { generateLocationUrl, type SharedLocation } from '../utils/deepLinking';
import { showToast } from '../utils/toast';
import { colors } from '../theme/colors';

interface ShareLocationButtonProps {
    location: SharedLocation;
    variant?: 'primary' | 'secondary' | 'icon';
    size?: 'small' | 'medium' | 'large';
}

export function ShareLocationButton({
    location,
    variant = 'primary',
    size = 'medium'
}: ShareLocationButtonProps) {
    const handleShare = async () => {
        try {
            const shareUrl = generateLocationUrl(location);
            const message = location.name
                ? `Check out ${location.name} on Gebeta Maps: ${shareUrl}`
                : `Check out this location on Gebeta Maps: ${shareUrl}`;

            const result = await Share.share({
                message,
                url: shareUrl,
                title: location.name || 'Shared Location',
            });

            if (result.action === Share.sharedAction) {
                showToast.success('Shared', 'Location shared successfully');
            }
        } catch (error) {
            console.error('Share error:', error);
            // Fallback to clipboard
            try {
                const shareUrl = generateLocationUrl(location);
                Clipboard.setString(shareUrl);
                showToast.success('Copied', 'Link copied to clipboard');
            } catch (clipboardError) {
                showToast.error('Error', 'Could not share location');
            }
        }
    };

    if (variant === 'icon') {
        return (
            <TouchableOpacity
                style={[styles.iconButton, size === 'small' && styles.iconButtonSmall]}
                onPress={handleShare}
            >
                <Ionicons
                    name="share-social"
                    size={size === 'small' ? 20 : 24}
                    color={colors.primary.main}
                />
            </TouchableOpacity>
        );
    }

    const buttonStyle = variant === 'primary' ? styles.primaryButton : styles.secondaryButton;
    const textStyle = variant === 'primary' ? styles.primaryText : styles.secondaryText;

    return (
        <TouchableOpacity
            style={[buttonStyle, size === 'small' && styles.smallButton]}
            onPress={handleShare}
        >
            <Ionicons
                name="share-social"
                size={size === 'small' ? 16 : 20}
                color={variant === 'primary' ? '#fff' : colors.primary.main}
                style={styles.icon}
            />
            <Text style={textStyle}>Share Location</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary.main,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.primary.main,
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    iconButtonSmall: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    smallButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    primaryText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryText: {
        color: colors.primary.main,
        fontSize: 16,
        fontWeight: '600',
    },
    icon: {
        marginRight: 8,
    },
});
