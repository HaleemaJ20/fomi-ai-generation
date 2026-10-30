export const cn = (...classes) => classes.filter(Boolean).join(' ');

export const formatTitle = (value) => value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
