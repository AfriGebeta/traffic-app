interface PresignedUrlResponse {
    objectName: string;
    url: string;
    maxSize: number;
}

export const uploadToMinio = async (imageUri: string, prefix: string = 'incidents'): Promise<string> => {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;

    if (!apiUrl) {
        throw new Error('api url not configured');
    }

    try {
        const filename = imageUri.split('/').pop() || 'photo.jpg';

        const presignedResponse = await fetch(`${apiUrl}/api/uploads/presigned`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prefix,
                filename,
            }),
        });

        if (!presignedResponse.ok) {
            throw new Error(`Failed to get presigned URL: ${presignedResponse.status}`);
        }

        const presignedData: PresignedUrlResponse = await presignedResponse.json();

        const imageResponse = await fetch(imageUri);
        const imageBlob = await imageResponse.blob();

        const extension = filename.toLowerCase().split('.').pop();
        let contentType = 'image/jpeg'; // def

        if (extension === 'png') {
            contentType = 'image/png';
        } else if (extension === 'jpg' || extension === 'jpeg') {
            contentType = 'image/jpeg';
        } else if (extension === 'webp') {
            contentType = 'image/webp';
        } else if (extension === 'gif') {
            contentType = 'image/gif';
        } else if (imageBlob.type) {
            contentType = imageBlob.type;
        }

        const uploadResponse = await fetch(presignedData.url, {
            method: 'PUT',
            body: imageBlob,
            headers: {
                'Content-Type': contentType,
            },
        });

        if (!uploadResponse.ok) {
            throw new Error(`failed to upload image : ${uploadResponse.status}`);
        }

        return presignedData.objectName;
    } catch (error) {
        throw error;
    }
};
