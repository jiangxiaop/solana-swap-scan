create table smart_money_address (
    id int primary key auto_increment,
    address varchar(42) not null comment '钱包地址',
    category varchar(255) not null comment '分类',
    category_score float not null comment '分类置信度',
    mark_name varchar(255) not null default '' comment '备注',
    last_analysis_time timestamp not null comment '最后分析时间',
    created_at timestamp default current_timestamp comment '创建时间',
    updated_at timestamp default current_timestamp on update current_timestamp comment '更新时间'
);