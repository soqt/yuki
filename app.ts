import dotenv from 'dotenv';
import express, { Express, Request, Response, NextFunction } from 'express';
import createError, { HttpError } from 'http-errors';
import path from 'path';
import logger from 'morgan';
import cors from 'cors';
import apiRouter from './src/routes/api';
// import { connectToRedis } from './src/redis';
dotenv.config();

// connectToRedis();

const app: Express = express();

app.use(logger('dev'));
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));


app.use('/api', apiRouter);

app.use('/healthz', function (req, res) {
  res.send('ok');
});


// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err: HttpError, req: Request, res: Response, next: NextFunction) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  // render the error page
  console.log(res.locals.message);
  res.statusMessage = err.message;
  res.status(err.status || 500).json( { errorMessage: err.message, status: err.status });
});

export default app;
