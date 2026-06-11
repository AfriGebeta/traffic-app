import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL!;
const TOKEN_STORAGE_KEY = '@traffic_app_token';

export interface ApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}

class ApiService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = API_URL;
    }

    private async getAuthHeaders(): Promise<HeadersInit> {
        try {
            const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
            if (token) {
                return {
                    'Authorization': `Bearer ${token}`,
                };
            }
        } catch (error) {

        }
        return {};
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        try {
            const url = `${this.baseUrl}${endpoint}`;

            const authHeaders = await this.getAuthHeaders();

            const config: RequestInit = {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders,
                    ...options.headers,
                },
            };

            const response = await fetch(url, config);

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return {
                    error: `Server returned non-JSON response (${response.status})`,
                };
            }

            const data = await response.json();

            if (!response.ok) {
                const errorMessage = data.message || data.error || `Request failed with status ${response.status}`;
                return {
                    error: errorMessage,
                    message: data.message,
                };
            }

            return {
                data: data as T,
            };
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : 'network error occurred',
            };
        }
    }

    async get<T>(endpoint: string, headers?: HeadersInit): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, {
            method: 'GET',
            headers,
        });
    }

    async post<T>(
        endpoint: string,
        body?: unknown,
        headers?: HeadersInit
    ): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
            headers,
        });
    }

    async put<T>(
        endpoint: string,
        body?: unknown,
        headers?: HeadersInit
    ): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, {
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
            headers,
        });
    }

    async delete<T>(endpoint: string, headers?: HeadersInit): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, {
            method: 'DELETE',
            headers,
        });
    }
}

export const apiService = new ApiService();
