import '@/lib/external-api-patch';
import { externalApi } from '@/lib/external-api';

(async function() {
  const apiAny: any = externalApi as any;
  console.log('getHeaders():', apiAny.getHeaders ? apiAny.getHeaders() : 'no getHeaders');
  console.log('request is function:', typeof apiAny.request === 'function');
})();
