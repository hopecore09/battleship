import { v4 as uuidv4 } from 'uuid';

export const generateId = () => uuidv4().slice(0, 8);

export const createGrid = (size) => {
  return Array.from({ length: size }, () => Array(size).fill(0));
};

export const getPlayerDisplayName = (name, existingNames) => {
  let displayName = name;
  let counter = 1;
  while (existingNames.includes(displayName)) {
    displayName = `${name} ${++counter}`;
  }
  return displayName;
};

export const isValidCoordinate = (row, col, size) => {
  return row >= 0 && row < size && col >= 0 && col < size;
};

export const getRandomInt = (max) => Math.floor(Math.random() * max);