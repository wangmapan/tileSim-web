import { GeneratedBridgeClient } from "../../contracts/generated/bridge-client";
import { apiRequest } from "./transport";

export const generatedBridgeClient = new GeneratedBridgeClient({ request: apiRequest });
