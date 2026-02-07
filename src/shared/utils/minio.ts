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

        console.log('requesting presigned url:', { apiUrl, prefix, filename });

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

        console.log('presigned status:', presignedResponse.status);

        if (!presignedResponse.ok) {
            const errorText = await presignedResponse.text();
            console.error('presigned url err:', errorText);

            throw new Error(`Failed to get presigned URL: ${presignedResponse.status} - ${errorText}`);
        }

        const presignedData: PresignedUrlResponse = await presignedResponse.json();
        console.log('presigned data received:', presignedData);

        console.log('fetching image from URI:', imageUri);
        const imageResponse = await fetch(imageUri);
        const imageBlob = await imageResponse.blob();
        console.log('img blob size:', imageBlob.size);

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

        console.log('uploading to minio url:', presignedData.url);
        console.log('Content-Type:', contentType);

        const uploadResponse = await fetch(presignedData.url, {
            method: 'PUT',
            body: imageBlob,
            headers: {
                'Content-Type': contentType,
            },
        });

        console.log('upload response status:', uploadResponse.status);

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('minio upload error:', errorText);
            throw new Error(`failed to upload image to MinIO: ${uploadResponse.status} - ${errorText}`);
        }

        const urlWithoutParams = presignedData.url.split('?')[0];
        console.log('upload successful, returning object name:', presignedData.objectName);
        return presignedData.objectName;
    } catch (error) {
        console.error('MinIO upload error:', error);
        throw error;
    }
};
