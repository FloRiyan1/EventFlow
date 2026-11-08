import { describe, expect, it } from 'vitest';
import {
  createModel,
  createEmptyProject,
  exportModelToJava,
  exportAllModelsToJava,
  parseJavaCode,
  importJavaIntoProject,
  mapTypeToJava,
  normalizeJavaType,
  type Model,
} from './index';

describe('Java Code Generation (Export)', () => {
  const sampleModel: Model = {
    id: 'm1',
    name: 'CustomerDto',
    description: 'Kundenstammdaten',
    fields: [
      { id: 'f1', name: 'id', type: 'String', nullable: false },
      { id: 'f2', name: 'age', type: 'int', nullable: true },
      { id: 'f3', name: 'balance', type: 'double', nullable: true },
      { id: 'f4', name: 'vip', type: 'bool', nullable: false },
      { id: 'f5', name: 'orders', type: 'List<OrderDto>', nullable: false },
    ],
  };

  it('maps types correctly to Java', () => {
    expect(mapTypeToJava('String')).toBe('String');
    expect(mapTypeToJava('int', false)).toBe('Integer');
    expect(mapTypeToJava('double', true)).toBe('Double');
    expect(mapTypeToJava('bool', false)).toBe('Boolean');
    expect(mapTypeToJava('List<OrderItem>')).toBe('List<OrderItem>');
    expect(mapTypeToJava('Map<String, User>')).toBe('Map<String, User>');
  });

  it('generates a clean Java Record with Jackson annotations', () => {
    const code = exportModelToJava(sampleModel, {
      style: 'record',
      packageName: 'com.example.dto',
      useJackson: true,
    });

    expect(code).toContain('package com.example.dto;');
    expect(code).toContain('import com.fasterxml.jackson.annotation.JsonProperty;');
    expect(code).toContain('import java.util.List;');
    expect(code).toContain('public record CustomerDto(');
    expect(code).toContain('@JsonProperty("id") String id');
    expect(code).toContain('@JsonProperty("orders") List<OrderDto> orders');
  });

  it('generates a standard POJO with constructors, getters, setters, and equals/hashCode', () => {
    const code = exportModelToJava(sampleModel, {
      style: 'pojo',
      packageName: 'com.example.dto',
      useJackson: true,
    });

    expect(code).toContain('public class CustomerDto {');
    expect(code).toContain('private String id;');
    expect(code).toContain('private List<OrderDto> orders;');
    expect(code).toContain('public String getId() {');
    expect(code).toContain('public void setId(String id) {');
    expect(code).toContain('public List<OrderDto> getOrders() {');
    expect(code).toContain('public boolean equals(Object o) {');
    expect(code).toContain('public int hashCode() {');
  });

  it('generates Lombok annotations when style=lombok', () => {
    const code = exportModelToJava(sampleModel, {
      style: 'lombok',
      packageName: 'com.example.dto',
    });

    expect(code).toContain('@Data');
    expect(code).toContain('@Builder');
    expect(code).toContain('@NoArgsConstructor');
    expect(code).toContain('@AllArgsConstructor');
    expect(code).toContain('public class CustomerDto {');
    expect(code).toContain('private String id;');
  });

  it('exports all project models in a batch', () => {
    const project = createEmptyProject('Shop');
    project.models = [
      sampleModel,
      {
        id: 'm2',
        name: 'OrderDto',
        description: '',
        fields: [{ id: 'f21', name: 'orderNr', type: 'String', nullable: false }],
      },
    ];

    const batch = exportAllModelsToJava(project, { style: 'record' });
    expect(batch).toContain('public record CustomerDto(');
    expect(batch).toContain('public record OrderDto(');
  });
});

describe('Java Code Parsing (Import)', () => {
  it('normalizes Java types to EventFlow conventions', () => {
    expect(normalizeJavaType('Integer')).toEqual({ type: 'int', isPrimitive: false });
    expect(normalizeJavaType('int')).toEqual({ type: 'int', isPrimitive: true });
    expect(normalizeJavaType('Double')).toEqual({ type: 'double', isPrimitive: false });
    expect(normalizeJavaType('BigDecimal')).toEqual({ type: 'double', isPrimitive: false });
    expect(normalizeJavaType('boolean')).toEqual({ type: 'bool', isPrimitive: true });
    expect(normalizeJavaType('List<CustomerDto>')).toEqual({ type: 'List<CustomerDto>', isPrimitive: false });
    expect(normalizeJavaType('Map<String, Object>')).toEqual({ type: 'Map<String, dynamic>', isPrimitive: false });
  });

  it('parses Java Records with Jackson and validation annotations', () => {
    const javaCode = `
      package com.example.models;

      import java.util.List;
      import com.fasterxml.jackson.annotation.JsonProperty;
      import jakarta.validation.constraints.NotNull;

      public record UserProfile(
          @NotNull String id,
          @JsonProperty("display_name") String displayName,
          @Nullable Integer age,
          boolean active,
          List<RoleDto> roles
      ) {}
    `;

    const result = parseJavaCode(javaCode);
    expect(result.models.length).toBe(1);
    const model = result.models[0];
    expect(model.name).toBe('UserProfile');
    expect(model.kind).toBe('record');
    expect(model.fields.length).toBe(5);

    expect(model.fields[0]).toMatchObject({
      name: 'id',
      type: 'String',
      nullable: false, // @NotNull
    });

    expect(model.fields[1]).toMatchObject({
      name: 'displayName',
      type: 'String',
      jsonName: 'display_name',
    });

    expect(model.fields[2]).toMatchObject({
      name: 'age',
      type: 'int',
      nullable: true,
    });

    expect(model.fields[3]).toMatchObject({
      name: 'active',
      type: 'bool',
      nullable: false, // primitive boolean
    });

    expect(model.fields[4]).toMatchObject({
      name: 'roles',
      type: 'List<RoleDto>',
    });
  });

  it('parses standard Java Classes (POJOs) with methods and constructors', () => {
    const javaCode = `
      package com.example.models;

      import java.util.List;

      public class ProductEntity {
          private static final long serialVersionUID = 1L;

          private String sku;
          private Double price;
          private boolean inStock = true;
          private List<String> tags;

          public ProductEntity() {
          }

          public ProductEntity(String sku, Double price) {
              this.sku = sku;
              this.price = price;
          }

          public String getSku() {
              return sku;
          }

          public void setSku(String sku) {
              this.sku = sku;
          }
      }
    `;

    const result = parseJavaCode(javaCode);
    expect(result.models.length).toBe(1);
    const p = result.models[0];
    expect(p.name).toBe('ProductEntity');
    expect(p.kind).toBe('class');
    expect(p.fields.map((f) => f.name)).toEqual(['sku', 'price', 'inStock', 'tags']);
    expect(p.fields.find((f) => f.name === 'price')?.type).toBe('double');
    expect(p.fields.find((f) => f.name === 'inStock')?.nullable).toBe(false);
  });

  it('parses multiple classes and records from a single source snippet', () => {
    const multiCode = `
      public record Order(String id, List<OrderItem> items) {}

      public class OrderItem {
          private String itemId;
          private int quantity;
          private double unitPrice;
      }
    `;

    const result = parseJavaCode(multiCode);
    expect(result.models.length).toBe(2);
    expect(result.models[0].name).toBe('Order');
    expect(result.models[1].name).toBe('OrderItem');
  });

  it('imports Java code directly into a Project and creates referenced models', () => {
    const project = createEmptyProject('ShopApp');
    expect(project.models.length).toBe(0);

    const javaSource = `
      public record Order(String id, List<OrderItem> items, Customer customer) {}
    `;

    const importResult = importJavaIntoProject(project, javaSource, {
      createReferencedModels: true,
    });

    expect(importResult.createdCount).toBe(1); // Order
    expect(importResult.referencedCreatedCount).toBe(2); // OrderItem and Customer
    expect(project.models.map((m) => m.name).sort()).toEqual(['Customer', 'Order', 'OrderItem']);

    const orderModel = project.models.find((m) => m.name === 'Order')!;
    expect(orderModel.fields.find((f) => f.name === 'items')?.type).toBe('List<OrderItem>');
  });

  it('merges updates into existing project models', () => {
    const project = createEmptyProject('ShopApp');
    project.models = [createModel('User', [{ id: 'f1', name: 'email', type: 'String', nullable: false }])];

    const javaUpdate = `
      public record User(String email, String username, int loginCount) {}
    `;

    const result = importJavaIntoProject(project, javaUpdate, { mergeExisting: true });
    expect(result.updatedCount).toBe(1);

    const user = project.models.find((m) => m.name === 'User')!;
    expect(user.fields.map((f) => f.name)).toEqual(['email', 'username', 'loginCount']);
  });

  it('handles empty models and missing types gracefully without throwing', () => {
    const emptyProj = createEmptyProject('Empty');
    expect(() => exportAllModelsToJava(emptyProj)).not.toThrow();

    const emptyModel = createModel('EmptyModel', []);
    expect(() => exportModelToJava(emptyModel)).not.toThrow();

    // Field with undefined or strange type
    expect(mapTypeToJava('')).toBe('Object');
    expect(mapTypeToJava(undefined as any)).toBe('Object');
  });

  it('exports abstract class and extends in Java POJO and Lombok', () => {
    const project = createEmptyProject('JavaInheritance');
    const base = createModel('AbstractEntity', [
      { id: 'f1', name: 'id', type: 'String', nullable: false },
    ], undefined, true);

    const child = createModel('CustomerEntity', [
      { id: 'f2', name: 'name', type: 'String', nullable: false },
    ], base.id, false);

    project.models = [base, child];

    const basePojo = exportModelToJava(base, { style: 'pojo', project });
    expect(basePojo).toContain('public abstract class AbstractEntity {');

    const childPojo = exportModelToJava(child, { style: 'pojo', project });
    expect(childPojo).toContain('public class CustomerEntity extends AbstractEntity {');

    // In record mode, models that extend a class must fall back to class
    const childRecord = exportModelToJava(child, { style: 'record', project });
    expect(childRecord).toContain('public class CustomerEntity extends AbstractEntity {');
  });

  it('imports abstract classes and extends from Java source code', () => {
    const project = createEmptyProject('ImportInheritance');
    const javaCode = `
      public abstract class BaseDto {
          private String id;
      }

      public class UserDto extends BaseDto {
          private String name;
      }
    `;

    const result = importJavaIntoProject(project, javaCode);
    expect(result.createdCount).toBe(2);

    const base = project.models.find((m) => m.name === 'BaseDto')!;
    const user = project.models.find((m) => m.name === 'UserDto')!;

    expect(base.isAbstract).toBe(true);
    expect(user.isAbstract).toBe(false);
    expect(user.extendsModelId).toBe(base.id);
  });
});
