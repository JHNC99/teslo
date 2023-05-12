import { ProductsModule } from './../products/products.module';
import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';

@Module({
  controllers: [SeedController],
  imports: [ProductsModule],
  providers: [SeedService],
})
export class SeedModule {}
