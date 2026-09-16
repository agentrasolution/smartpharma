export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(403, message);
  }
}

export class PaymentRequiredError extends AppError {
  code: string;
  constructor(message = "Your subscription is inactive or expired", code = "SUBSCRIPTION_REQUIRED") {
    super(402, message);
    this.name = "PaymentRequiredError";
    this.code = code;
  }
}
