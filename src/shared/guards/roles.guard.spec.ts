import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  const mockReflector = { getAllAndOverride: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
  });

  const buildContext = (role: string): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role } }),
      }),
    }) as unknown as ExecutionContext;

  it('should allow when no roles are required', () => {
    mockReflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(buildContext('COLLABORATOR'))).toBe(true);
  });

  it('should allow when user has required role', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(guard.canActivate(buildContext('ADMIN'))).toBe(true);
  });

  it('should throw ForbiddenException when user does not have required role', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(buildContext('COLLABORATOR'))).toThrow(ForbiddenException);
  });
});
