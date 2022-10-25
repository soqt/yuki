import { NextFunction, Request, Response } from 'express';
import { sendGm } from '../gm/service';

const gm = async (req: Request, res: Response, next: NextFunction) => {
  const { openid, location } = req.query;

  if (!openid || !location) {
    res.status(400).send({ errorMessage: 'openid or location is required' });
    return;
  }

  try {
    await sendGm(location as string, openid as string);
    res.send({ message: 'ok' });
  } catch (err) {
    console.log('lalala');
    next(err);
  }
};

export { gm };