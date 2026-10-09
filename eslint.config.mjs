import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  { ignores: ["test-results/**", "playwright-report/**", "output/**", ".playwright-cli/**"] },
];

export default config;
