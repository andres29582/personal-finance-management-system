import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<
    Pick<UsersService, 'getProfile' | 'updateProfile'>
  >;

  beforeEach(async () => {
    usersService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates getMe to the service', async () => {
    usersService.getProfile.mockResolvedValue({
      id: 'user-1',
      nome: 'Ana',
    } as never);

    const result = await controller.getMe({
      user: {
        id: 'user-1',
        email: 'test@test.com',
        nome: 'Ana',
        sid: 'session-1',
      },
    } as never);

    expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
    expect(result.id).toBe('user-1');
  });

  it('delegates updateMe to the service', async () => {
    usersService.updateProfile.mockResolvedValue({
      id: 'user-1',
      cpf: '52998224725',
    } as never);

    const result = await controller.updateMe(
      {
        user: {
          id: 'user-1',
          email: 'test@test.com',
          nome: 'Ana',
          sid: 'session-1',
        },
      } as never,
      { cpf: '529.982.247-25' },
    );

    expect(usersService.updateProfile).toHaveBeenCalledWith('user-1', {
      cpf: '529.982.247-25',
    });
    expect(result.cpf).toBe('52998224725');
  });
});
