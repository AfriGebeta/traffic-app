import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAppCheckToken } from '../utils/appCheck';
import { CLIENT_HEADERS } from '../utils/clientHeaders';

const API_URL = process.env.EXPO_PUBLIC_API_URL!;
const TOKEN_STORAGE_KEY = '@traffic_app_token';

export interface ApiResponse<T> {
    data?: T;
    error?: string;
    errorData?: unknown;
    errorBody?: any;
    message?: string;
    status?: number;
}

const toErrorMessage = (data: any, status: number): string => {
    if (data?.message) return data.message;
    if (typeof data?.error === 'string') return data.error;
    if (data?.error?.elaboration) return data.error.elaboration;
    return `Request failed with status ${status}`;
};

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
            const appCheckToken = await getAppCheckToken();

            const config: RequestInit = {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...CLIENT_HEADERS,
                    ...authHeaders,
                    ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
                    ...options.headers,
                },
            };

            const response = await fetch(url, config);

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return {
                    error: `Server returned non-JSON response (${response.status})`,
                    status: response.status,
                };
            }

            const data = await response.json();

            if (!response.ok) {
                const errorMessage = toErrorMessage(data, response.status);
                console.error(`API ${options.method || 'GET'} ${endpoint} failed (${response.status}):`, JSON.stringify(data));
                return {
                    error: errorMessage,
                    errorData: data.error,
                    errorBody: data,
                    message: data.message,
                    status: response.status,
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
        headers?: HeadersInit,
        signal?: AbortSignal
    ): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
            headers,
            ...(signal ? { signal } : {}),
        });
    }

    private async requestFormData<T>(
        method: 'POST' | 'PATCH',
        endpoint: string,
        formData: FormData
    ): Promise<ApiResponse<T>> {
        try {
            const url = `${this.baseUrl}${endpoint}`;

            const authHeaders = await this.getAuthHeaders();
            const appCheckToken = await getAppCheckToken();

            const response = await fetch(url, {
                method,
                headers: {
                    ...CLIENT_HEADERS,
                    ...authHeaders,
                    ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
                },
                body: formData,
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return {
                    error: `Server returned non-JSON response (${response.status})`,
                    status: response.status,
                };
            }

            const data = await response.json();

            if (!response.ok) {
                const errorMessage = toErrorMessage(data, response.status);
                console.error(`API ${method}(form) ${endpoint} failed (${response.status}):`, JSON.stringify(data));
                return {
                    error: errorMessage,
                    errorData: data.error,
                    errorBody: data,
                    message: data.message,
                    status: response.status,
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

    async postFormData<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
        return this.requestFormData<T>('POST', endpoint, formData);
    }

    async patchFormData<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
        return this.requestFormData<T>('PATCH', endpoint, formData);
    }

    async patch<T>(
        endpoint: string,
        body?: unknown,
        headers?: HeadersInit
    ): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, {
            method: 'PATCH',
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
