import axios from "axios";

// IMPORTANTE: usar el mismo baseURL que services/api.ts
// Si difieren, algunos servicios dan 404 porque les falta el prefijo /api
export const api = axios.create({
  baseURL: "/api",
});
