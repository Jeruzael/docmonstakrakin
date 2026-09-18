import fs from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';

/** One local snapshot includes canonical changes, review dispositions and audit atomically. */
export function installProjectPersistence(app: Express, store: any) {
  const filename = path.join(process.cwd(), '.local', 'project-state.json');
  if (fs.existsSync(filename)) {
    const saved = JSON.parse(fs.readFileSync(filename,'utf8'));
    if (saved.schemaVersion !== 1 || !Array.isArray(saved.state?.projects)) throw new Error('Invalid local project snapshot; preserve file for recovery');
    for (const key of Object.keys(store)) if (Object.hasOwn(saved.state,key)) store[key] = saved.state[key];
  }
  app.use('/api/projects', (req,res,next)=>{
    if (!['POST','PATCH','PUT','DELETE'].includes(req.method) && !(req.method === 'GET' && req.path.endsWith('/package/export'))) return next();
    const before = structuredClone({...store});
    const send = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          fs.mkdirSync(path.dirname(filename),{recursive:true});
          fs.writeFileSync(filename+'.tmp',JSON.stringify({schemaVersion:1,state:store}),'utf8');
          fs.renameSync(filename+'.tmp',filename);
        } catch (error) {
          Object.assign(store,before); res.status(500); return send({error:'Failed to persist project transaction; changes rolled back'});
        }
      } else Object.assign(store,before);
      return send(body);
    };
    next();
  });
}
