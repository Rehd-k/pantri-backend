import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/client';
import {
  CurrentUser,
  type AuthUserPayload,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  WishlistItemResponseDto,
  WishlistListResponseDto,
  WishlistStatusDto,
} from './dto/wishlist-response.dto';
import { WishlistService } from './wishlist.service';

@Controller('wishlist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYEE)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUserPayload,
  ): Promise<WishlistListResponseDto> {
    return this.wishlistService.list(user.id);
  }

  @Get(':productId/status')
  status(
    @CurrentUser() user: AuthUserPayload,
    @Param('productId') productId: string,
  ): Promise<WishlistStatusDto> {
    return this.wishlistService.status(user.id, productId);
  }

  @Post(':productId')
  add(
    @CurrentUser() user: AuthUserPayload,
    @Param('productId') productId: string,
  ): Promise<WishlistItemResponseDto> {
    return this.wishlistService.add(user.id, productId);
  }

  @Delete(':productId')
  remove(
    @CurrentUser() user: AuthUserPayload,
    @Param('productId') productId: string,
  ): Promise<WishlistStatusDto> {
    return this.wishlistService.remove(user.id, productId);
  }
}
