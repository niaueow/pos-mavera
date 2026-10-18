import { Request, Response, NextFunction } from 'express';
import { menuService } from '../services/menu.service';
import { sendSuccess } from '../utils/response';
import { GetMenusQuery, GetMenuByIdParams } from '../validators/menu.validator';

export class MenuController {
  async getMenus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as GetMenusQuery;
      const result = await menuService.getPublicMenus(query);

      sendSuccess(res, result.items, 'Menus retrieved successfully', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getMenuById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as GetMenuByIdParams;
      const item = await menuService.getPublicMenuById(id);

      sendSuccess(res, item, 'Menu retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const menuController = new MenuController();
