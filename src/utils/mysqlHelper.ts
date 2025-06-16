
import client from "../../config/db.ts";

/**
 * 通用 MySQL 查询函数，支持占位参数绑定。
 * @param sql SQL 查询语句
 * @param params 占位符参数数组
 * @returns 查询结果（SELECT 返回数组，其它返回执行信息）
 */
export async function commonQuery<T = unknown>(
    sql: string,
    params: (string | number | null | boolean)[] = []
): Promise<T[]> {
    try {
        const result = await client.query(sql, params);
        // console.log("commonQuery:",result);
        return result as T[];
    } catch (err) {
        console.error("MySQL 执行失败:", err);
        throw err;
    }
}