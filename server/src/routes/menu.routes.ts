import { Router } from 'express';
import { menuController } from '../controllers/menu.controller';
import { validateQuery, validateParams } from '../middlewares/validate';
import { getMenusQuerySchema, getMenuByIdParamsSchema } from '../validators/menu.validator';

const router = Router();

router.get('/', validateQuery(getMenusQuerySchema), (req, res, next) => {
  menuController.getMenus(req, res, next);
});

router.get('/:id', validateParams(getMenuByIdParamsSchema), (req, res, next) => {
  menuController.getMenuById(req, res, next);
});

export default router;
