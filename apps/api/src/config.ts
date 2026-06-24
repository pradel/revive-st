declare const process: {
  env: {
    DATABASE_URL?: string;
    RAILWAY_VOLUME_MOUNT_PATH?: string;
  };
};

export const dbUrl =
  process.env.DATABASE_URL ??
  (process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? `file:${process.env.RAILWAY_VOLUME_MOUNT_PATH}/revivest.db`
    : "file:revivest.db");
