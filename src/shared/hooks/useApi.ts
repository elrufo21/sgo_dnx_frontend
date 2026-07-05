import { useState } from "react";
import axios, { type AxiosRequestConfig, type Method } from "axios";

export function useApi<TResponse = unknown, TBody = unknown>() {
  const [data, setData] = useState<TResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const request = async (
    url: string,
    method: Method = "GET",
    body: TBody | null = null,
    config: AxiosRequestConfig = {},
    fallback: TResponse | null = null
  ): Promise<TResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios({
        url,
        method,
        data: body,
        ...config,
      });

      const result = response.data;

      if (typeof result === "string" && result.startsWith("<!DOCTYPE")) {
        console.warn("⚠️ API devolvió HTML. Usando fallback.");
        setData(fallback);
        return fallback as TResponse;
      }

      setData(result);
      return result as TResponse;
    } catch (err) {
      console.warn("⚠️ Error en API, usando fallback");
      setError(err);
      setData(fallback);
      return fallback as TResponse;
    } finally {
      setLoading(false);
    }
  };

  return { request, data, error, loading };
}
