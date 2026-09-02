import { Injectable } from '@nestjs/common';
import {
  DinerDetails,
  ManagerDetails,
  StaffDetails,
  User,
} from 'src/common/types/schema.types';

@Injectable()
export class UserRepository {
  private readonly users: User[] = [];
  private readonly dinerDetails: DinerDetails[] = [];
  private readonly managerDetails: ManagerDetails[] = [];
  private readonly staffDetails: StaffDetails[] = [];

  findAll(): User[] {
    return [...this.users];
  }

  findById(id: string): User | undefined {
    return this.users.find((user) => user.id === id);
  }

  findByEmail(email: string): User | undefined {
    return this.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  }

  create(user: User): User {
    this.users.push(user);
    return user;
  }

  update(id: string, payload: Partial<User>): User | undefined {
    const user = this.findById(id);
    if (!user) {
      return undefined;
    }

    Object.assign(user, payload);
    return user;
  }

  remove(id: string): boolean {
    const index = this.users.findIndex((user) => user.id === id);
    if (index === -1) {
      return false;
    }

    this.users.splice(index, 1);
    this.dinerDetails.splice(
      this.dinerDetails.findIndex((d) => d.diner_id === id),
      1,
    );
    this.managerDetails.splice(
      this.managerDetails.findIndex((m) => m.manager_id === id),
      1,
    );
    this.staffDetails.splice(
      this.staffDetails.findIndex((s) => s.staff_id === id),
      1,
    );

    return true;
  }

  getDinerDetails(dinerId: string): DinerDetails | undefined {
    return this.dinerDetails.find((d) => d.diner_id === dinerId);
  }

  upsertDinerDetails(details: DinerDetails): DinerDetails {
    const index = this.dinerDetails.findIndex((d) => d.diner_id === details.diner_id);
    if (index >= 0) {
      this.dinerDetails[index] = details;
      return details;
    }

    this.dinerDetails.push(details);
    return details;
  }

  getManagerDetails(managerId: string): ManagerDetails | undefined {
    return this.managerDetails.find((m) => m.manager_id === managerId);
  }

  upsertManagerDetails(details: ManagerDetails): ManagerDetails {
    const index = this.managerDetails.findIndex(
      (m) => m.manager_id === details.manager_id,
    );
    if (index >= 0) {
      this.managerDetails[index] = details;
      return details;
    }

    this.managerDetails.push(details);
    return details;
  }

  getStaffDetails(staffId: string): StaffDetails | undefined {
    return this.staffDetails.find((s) => s.staff_id === staffId);
  }

  upsertStaffDetails(details: StaffDetails): StaffDetails {
    const index = this.staffDetails.findIndex((s) => s.staff_id === details.staff_id);
    if (index >= 0) {
      this.staffDetails[index] = details;
      return details;
    }

    this.staffDetails.push(details);
    return details;
  }
}
