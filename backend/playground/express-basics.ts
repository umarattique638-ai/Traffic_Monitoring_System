import express from 'express';
import type { NextFunction, Request, Response } from 'express';

const app = express();

// Middleware 1: har request ka log
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Body ko JSON se object banao
app.use(express.json());

// GET route
app.get('/hello', (_req: Request, res: Response) => {
  res.json({ message: 'Salam dunya!' });
});

// URL params aur query
app.get('/users/:id', (req: Request, res: Response) => {
  res.json({ id: req.params.id, sort: req.query.sort ?? 'none' });
});

// POST route: body parhna aur status code
app.post('/echo', (req: Request, res: Response) => {
  if (!req.body?.name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  res.status(201).json({ youSent: req.body });
});

// Chaukidar middleware sirf ek route par
function onlyWithKey(req: Request, res: Response, next: NextFunction) {
  if (req.headers['x-key'] !== 'secret') {
    res.status(401).json({ error: 'key ghalat hai' });
    return;
  }
  next();
}
app.get('/secret', onlyWithKey, (_req: Request, res: Response) => {
  res.json({ data: 'yeh sirf key walon ke liye' });
});

// Router: routes ka group
const router = express.Router();
router.get('/list', (_req: Request, res: Response) => {
  res.json(['a', 'b']);
});
app.use('/items', router);

// Error handler (chaar parameters)
app.get('/boom', () => {
  throw new Error('kuch toot gaya');
});
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ error: err.message });
});

app.listen(4000, () => console.log('Practice server: http://localhost:4000'));
