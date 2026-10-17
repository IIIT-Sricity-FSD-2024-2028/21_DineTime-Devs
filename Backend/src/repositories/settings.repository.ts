import { store } from 'src/common/storage/memory-store';
import { Injectable } from '@nestjs/common';
import { Role } from 'src/common/enums/role.enum';
import { Setting, UserSetting } from 'src/common/types/schema.types';

@Injectable()
export class SettingsRepository {
  private readonly settings: Setting[] = store.collection<Setting>('settings', [
    {
      id: 'setting_diner_notifications',
      key: 'notifications',
      description: 'Receive diner notifications',
      role: Role.DINER,
    },
    {
      id: 'setting_manager_alerts',
      key: 'manager_alerts',
      description: 'Receive manager alerts',
      role: Role.MANAGER,
    },
    {
      id: 'setting_staff_updates',
      key: 'staff_updates',
      description: 'Receive staff updates',
      role: Role.STAFF,
    },
  ]);

  private readonly userSettings: UserSetting[] = store.collection<UserSetting>('userSettings');

  findAllSettings(): Setting[] {
    return [...this.settings];
  }

  findSettingsByRole(role: Role): Setting[] {
    return this.settings.filter((setting) => setting.role === role);
  }

  findSettingById(id: string): Setting | undefined {
    return this.settings.find((setting) => setting.id === id);
  }

  createSetting(setting: Setting): Setting {
    this.settings.push(setting);
    return setting;
  }

  updateSetting(id: string, payload: Partial<Setting>): Setting | undefined {
    const setting = this.findSettingById(id);
    if (!setting) {
      return undefined;
    }

    Object.assign(setting, payload);
    return setting;
  }

  removeSetting(id: string): boolean {
    const index = this.settings.findIndex((setting) => setting.id === id);
    if (index === -1) {
      return false;
    }

    this.settings.splice(index, 1);
    return true;
  }

  findUserSettingsByUserId(userId: string): UserSetting[] {
    return this.userSettings.filter((setting) => setting.user_id === userId);
  }

  findUserSettingById(id: string): UserSetting | undefined {
    return this.userSettings.find((setting) => setting.id === id);
  }

  createUserSetting(userSetting: UserSetting): UserSetting {
    this.userSettings.push(userSetting);
    return userSetting;
  }

  updateUserSetting(id: string, payload: Partial<UserSetting>): UserSetting | undefined {
    const setting = this.findUserSettingById(id);
    if (!setting) {
      return undefined;
    }

    Object.assign(setting, payload);
    return setting;
  }

  upsertUserSetting(setting: UserSetting): UserSetting {
    const existing = this.userSettings.find(
      (item) =>
        item.user_id === setting.user_id && item.setting_id === setting.setting_id,
    );

    if (existing) {
      existing.value = setting.value;
      return existing;
    }

    this.userSettings.push(setting);
    return setting;
  }
}
