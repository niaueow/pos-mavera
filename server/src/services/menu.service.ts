import { Menu, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/errorHandler';
import { GetMenusQuery } from '../validators/menu.validator';

export interface PublicMenuDto {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string | null;
  image_url: string | null;
  photo_url: string | null;
  is_available: boolean;
  available: boolean;
  has_spice_level: boolean;
  sort_order: number;
}

export interface GetPublicMenusResult {
  items: PublicMenuDto[];
  meta?: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
}

function mapToPublicMenuDto(menu: Menu): PublicMenuDto {
  return {
    id: menu.id,
    name: menu.name,
    category: menu.category,
    price: menu.price,
    description: menu.description,
    image_url: menu.imageUrl,
    photo_url: menu.imageUrl,
    is_available: menu.isAvailable,
    available: menu.isAvailable,
    has_spice_level: menu.hasSpiceLevel,
    sort_order: menu.sortOrder,
  };
}

export class MenuService {
  /**
   * Fetch public catalog of active, non-deleted menus with optional search & pagination.
   */
  async getPublicMenus(query: GetMenusQuery): Promise<GetPublicMenusResult> {
    const searchTerm = (query.search || query.q || '').trim();

    const where: Prisma.MenuWhereInput = {
      isDeleted: false,
      isAvailable: true,
    };

    if (query.category) {
      where.category = {
        equals: query.category,
        mode: 'insensitive',
      };
    }

    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const isPaginated = query.page !== undefined || query.limit !== undefined;

    if (isPaginated) {
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const skip = (page - 1) * limit;

      const [totalItems, menus] = await Promise.all([
        prisma.menu.count({ where }),
        prisma.menu.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        }),
      ]);

      const totalPages = Math.ceil(totalItems / limit);

      return {
        items: menus.map(mapToPublicMenuDto),
        meta: {
          page,
          limit,
          total_items: totalItems,
          total_pages: totalPages,
        },
      };
    }

    const menus = await prisma.menu.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return {
      items: menus.map(mapToPublicMenuDto),
    };
  }

  /**
   * Fetch single active, non-deleted menu item by ID.
   */
  async getPublicMenuById(id: number): Promise<PublicMenuDto> {
    const menu = await prisma.menu.findFirst({
      where: {
        id,
        isDeleted: false,
        isAvailable: true,
      },
    });

    if (!menu) {
      throw new AppError(404, 'NOT_FOUND', 'Menu item not found or unavailable');
    }

    return mapToPublicMenuDto(menu);
  }
}

export const menuService = new MenuService();
