import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetWorkspaceId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.params.workspaceId || request.headers['x-workspace-id'];
  },
);

export const GetUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.id || request.headers['x-user-id'];
  },
);

