import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function hasAtMostTwoDecimalPlaces(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return false;
  }

  const [coefficient, exponent = '0'] = Math.abs(value).toString().split('e');
  const decimalPlaces =
    (coefficient.split('.')[1]?.length ?? 0) - Number(exponent);

  return decimalPlaces <= 2;
}

export function HasAtMostTwoDecimalPlaces(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'hasAtMostTwoDecimalPlaces',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      validator: {
        validate: hasAtMostTwoDecimalPlaces,
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} deve ter no maximo 2 casas decimais.`;
        },
      },
    });
  };
}
