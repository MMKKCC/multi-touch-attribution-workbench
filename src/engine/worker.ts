import { expose } from 'comlink';
import { AttributionEngine } from './AttributionEngine.js';

// Instantiate the engine singleton inside the worker
const engine = new AttributionEngine();

// Expose the engine instance over the Comlink RPC bridge.
// The main thread wraps this with Comlink.wrap<IAttributionEngine>().
expose(engine);
