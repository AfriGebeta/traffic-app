const API_URL = process.env.EXPO_PUBLIC_API_URL!;

export interface ApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}

class ApiService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = API_URL;
        console.log('API Base URL:', this.baseUrl);
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        try {
            const url = `${this.baseUrl}${endpoint}`;
            const config: RequestInit = {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            };

            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                return {
                    error: data.message || data.error || 'an error occurred',
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
