import type {Plugin} from 'vite';
import {localRequestBoundary,resolveLocalNetworkConfig} from './localPerimeter.ts';

/** Vite dev/preview are separate ingress paths; CLI overrides must also fail closed. */
export function localVitePerimeter():Plugin {
  return {
    name:'dmk-local-perimeter',
    configResolved(config){
      resolveLocalNetworkConfig();
      for(const options of [config.server,config.preview]){
        const port=options.port;
        if(options.host!=='127.0.0.1'||options.https||typeof port!=='number'||!Number.isInteger(port)||port<0||port>65535){
          throw new Error('UNSUPPORTED_LOCAL_VITE_CONFIG: use IPv4 loopback, HTTP and a valid local port');
        }
      }
      // No independently listening WebSocket/HMR server during containment.
      if(config.server.ws!==false||config.server.hmr!==false)throw new Error('UNSUPPORTED_LOCAL_VITE_CONFIG: auxiliary WebSocket/HMR listeners are disabled');
    },
    configureServer(server){server.middlewares.use(localRequestBoundary);},
    configurePreviewServer(server){server.middlewares.use(localRequestBoundary);},
  };
}
