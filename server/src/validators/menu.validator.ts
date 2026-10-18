import { z } from 'zod';

export const getMenusQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100, 'Search query must not exceed 100 characters')
    .optional(),
  search: z
    .string()
    .trim()
    .max(100, 'Search query must not exceed 100 characters')
    .optional(),
  category: z
    .string()
    .trim()
    .max(50, 'Category must not exceed 50 characters')
    .optional(),
  page: z.coerce
    .number({ invalid_type_error: 'Page must be a valid number' })
    .int('Page must be an integer')
    .positive('Page must be greater than 0')
    .optional(),
  limit: z.coerce
    .number({ invalid_type_error: 'Limit must be a valid number' })
    .int('Limit must be an integer')
    .positive('Limit must be greater than 0')
    .max(100, 'Limit cannot exceed 100')
    .optional(),
});

export const getMenuByIdParamsSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: 'Menu ID must be a valid number' })
    .int('Menu ID must be an integer')
    .positive('Menu ID must be greater than 0'),
});

export type GetMenusQuery = z.infer<typeof getMenusQuerySchema>;
export type GetMenuByIdParams = z.infer<typeof getMenuByIdParamsSchema>;
