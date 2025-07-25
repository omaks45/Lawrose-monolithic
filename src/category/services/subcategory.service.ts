/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSubcategoryDto } from '../dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from '../dto/update-subcategory.dto';
import { SubcategoryQueryDto } from '../dto/subcategory-query.dto';
import { PaginatedResponseDto } from 'src/common/dto/response.dto';
import { generateSlug } from 'src/common/utils/slug.util';
import { Prisma, Subcategory } from '@prisma/client';

export interface SubcategoryWithCounts extends Subcategory {
  productCount?: number;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
}

@Injectable()
export class SubcategoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new subcategory with optimized validation
   * Time Complexity: O(log n) for checks + O(1) for creation
   */
  async create(createSubcategoryDto: CreateSubcategoryDto): Promise<Subcategory> {
    const { name, slug: providedSlug, categoryId, ...rest } = createSubcategoryDto;

    // Generate slug - O(1)
    const slug = providedSlug || generateSlug(name);

    // Batch validation in parallel - O(log n) each
    const [categoryExists, existingSubcategory] = await Promise.all([
      this.prisma.category.findUnique({
        where: { id: categoryId, isActive: true },
        select: { id: true, name: true }
      }),
      this.prisma.subcategory.findFirst({
        where: {
          OR: [
            { 
              name: { equals: name, mode: 'insensitive' },
              categoryId 
            },
            { categoryId, slug }
          ]
        },
        select: { id: true, name: true, slug: true, categoryId: true }
      })
    ]);

    if (!categoryExists) {
      throw new NotFoundException(`Category with ID ${categoryId} not found or inactive`);
    }

    if (existingSubcategory) {
      if (existingSubcategory.name.toLowerCase() === name.toLowerCase() && 
          existingSubcategory.categoryId === categoryId) {
        throw new ConflictException('Subcategory with this name already exists in this category');
      }
      if (existingSubcategory.slug === slug && existingSubcategory.categoryId === categoryId) {
        throw new ConflictException('Subcategory with this slug already exists in this category');
      }
    }

    // Single database write - O(1)
    return this.prisma.subcategory.create({
      data: {
        name,
        slug,
        categoryId,
        ...rest
      }
    });
  }

  /**
   * Find all subcategories with advanced filtering
   * Time Complexity: O(log n + k) where k is result set size
   */
  async findAll(query: SubcategoryQueryDto): Promise<PaginatedResponseDto<SubcategoryWithCounts>> {
    const {
      page = 1,
      limit = 10,
      search,
      categoryId,
      isActive,
      sortBy = 'sortOrder',
      sortOrder = 'asc',
      includeProductCount = false
    } = query;

    const skip = (page - 1) * limit;

    // Build optimized where clause
    const where: Prisma.SubcategoryWhereInput = {
      ...(isActive !== undefined && { isActive }),
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    // Build optimized select clause
    const select: Prisma.SubcategorySelect = {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      metaTitle: true,
      metaDescription: true,
      sortOrder: true,
      isActive: true,
      categoryId: true,
      createdAt: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      ...(includeProductCount && {
        _count: {
          select: {
            products: { where: { isActive: true } }
          }
        }
      })
    };

    // Execute parallel queries - O(log n) each
    const [subcategories, total] = await Promise.all([
      this.prisma.subcategory.findMany({
        where,
        select,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder }
      }),
      this.prisma.subcategory.count({ where })
    ]);

    // Transform results - O(k)
    const transformedSubcategories = subcategories.map(subcategory => {
      if (includeProductCount && '_count' in subcategory) {
        const { _count, ...rest } = subcategory;
        return {
          ...rest,
          productCount: _count.products
        };
      }
      return subcategory;
    }) as SubcategoryWithCounts[];

    const totalPages = Math.ceil(total / limit);

    return {
      data: transformedSubcategories,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };
  }

  /**
   * Find subcategories by category ID with optimization
   * Time Complexity: O(log n + k)
   */
  async findByCategory(categoryId: string): Promise<SubcategoryWithCounts[]> {
    if (!categoryId || typeof categoryId !== 'string') {
      throw new BadRequestException('Invalid category ID');
    }

    // Check if category exists - O(log n)
    const categoryExists = await this.prisma.category.findUnique({
      where: { id: categoryId, isActive: true },
      select: { id: true }
    });

    if (!categoryExists) {
      throw new NotFoundException(`Category with ID ${categoryId} not found or inactive`);
    }

    // Get subcategories with counts - O(log n + k)
    const subcategories = await this.prisma.subcategory.findMany({
      where: { 
        categoryId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        metaTitle: true,
        metaDescription: true,
        sortOrder: true,
        isActive: true,
        categoryId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            products: { where: { isActive: true } }
          }
        }
      },
      orderBy: { sortOrder: 'asc' }
    });

    return subcategories.map(subcategory => {
      const { _count, ...rest } = subcategory;
      return {
        ...rest,
        productCount: _count.products
      };
    });
  }

  /**
   * Find subcategory by ID with optimized includes
   * Time Complexity: O(log n)
   */
  async findOne(id: string): Promise<SubcategoryWithCounts> {
    if (!id || typeof id !== 'string') {
      throw new BadRequestException('Invalid subcategory ID');
    }

    const subcategory = await this.prisma.subcategory.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        metaTitle: true,
        metaDescription: true,
        sortOrder: true,
        isActive: true,
        categoryId: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        _count: {
          select: {
            products: { where: { isActive: true } }
          }
        }
      }
    });

    if (!subcategory) {
      throw new NotFoundException(`Subcategory with ID ${id} not found`);
    }

    const { _count, ...rest } = subcategory;
    return {
      ...rest,
      productCount: _count.products
    };
  }

  /**
   * Update subcategory with conflict checking
   * Time Complexity: O(log n) for checks + O(1) for update
   */
  async update(id: string, updateSubcategoryDto: UpdateSubcategoryDto): Promise<Subcategory> {
    if (!id || typeof id !== 'string') {
      throw new BadRequestException('Invalid subcategory ID');
    }

    const { name, slug: providedSlug, ...rest } = updateSubcategoryDto;

    // Check if subcategory exists - O(log n)
    const existingSubcategory = await this.prisma.subcategory.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, categoryId: true }
    });

    if (!existingSubcategory) {
      throw new NotFoundException(`Subcategory with ID ${id} not found`);
    }

    // Handle slug generation
    const slug = providedSlug || (name ? generateSlug(name) : undefined);

    // Check for conflicts within the same category - O(log n)
    if (name || slug) {
      const conflicts = await this.prisma.subcategory.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { categoryId: existingSubcategory.categoryId },
            {
              OR: [
                ...(name ? [{ name: { equals: name, mode: Prisma.QueryMode.insensitive } }] : []),
                ...(slug ? [{ slug }] : [])
              ]
            }
          ]
        },
        select: { name: true, slug: true }
      });

      if (conflicts) {
        if (name && conflicts.name.toLowerCase() === name.toLowerCase()) {
          throw new ConflictException('Subcategory with this name already exists in this category');
        }
        if (slug && conflicts.slug === slug) {
          throw new ConflictException('Subcategory with this slug already exists in this category');
        }
      }
    }

    // Single database update - O(1)
    return this.prisma.subcategory.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...rest
      }
    });
  }

  /**
   * Soft delete subcategory with dependency check
   * Time Complexity: O(log n) for checks + O(1) for update
   */
  async remove(id: string): Promise<{ message: string }> {
    if (!id || typeof id !== 'string') {
      throw new BadRequestException('Invalid subcategory ID');
    }

    // Check existence and dependencies - O(log n)
    const subcategory = await this.prisma.subcategory.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            products: true
          }
        }
      }
    });

    if (!subcategory) {
      throw new NotFoundException(`Subcategory with ID ${id} not found`);
    }

    if (subcategory._count.products > 0) {
      throw new ConflictException(
        `Cannot delete subcategory '${subcategory.name}' because it has ${subcategory._count.products} products`
      );
    }

    // Soft delete - O(1)
    await this.prisma.subcategory.update({
      where: { id },
      data: { isActive: false }
    });

    return { message: `Subcategory '${subcategory.name}' has been successfully deactivated` };
  }

  /**
   * Bulk update sort orders within a category
   * Time Complexity: O(n) where n is the number of updates
   */
  async bulkUpdateSortOrder(
    categoryId: string,
    updates: Array<{ id: string; sortOrder: number }>
  ): Promise<{ updated: number }> {
    if (!categoryId || !Array.isArray(updates) || updates.length === 0) {
      throw new BadRequestException('Category ID and updates array are required');
    }

    // Validate category exists and all subcategories belong to it - O(log n)
    const [categoryExists, existingSubcategories] = await Promise.all([
      this.prisma.category.findUnique({
        where: { id: categoryId },
        select: { id: true }
      }),
      this.prisma.subcategory.findMany({
        where: { 
          id: { in: updates.map(u => u.id) },
          categoryId 
        },
        select: { id: true }
      })
    ]);

    if (!categoryExists) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    const existingIds = new Set(existingSubcategories.map(s => s.id));
    const invalidIds = updates.filter(u => !existingIds.has(u.id));

    if (invalidIds.length > 0) {
      throw new BadRequestException(`Invalid subcategory IDs: ${invalidIds.map(u => u.id).join(', ')}`);
    }

    // Bulk update in transaction - O(n)
    await this.prisma.$transaction(
      updates.map(({ id, sortOrder }) =>
        this.prisma.subcategory.update({
          where: { id },
          data: { sortOrder }
        })
      )
    );

    return { updated: updates.length };
  }
}