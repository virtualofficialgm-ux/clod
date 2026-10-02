-- Parri · новые значения перечислений (отдельной миграцией: добавленное значение enum
-- нельзя использовать в той же транзакции, где оно создано).

-- 22 категории задач, как на theparri.com
alter type public.task_category add value if not exists 'research' after 'study';
alter type public.task_category add value if not exists 'music' after 'photo';
alter type public.task_category add value if not exists '3d' after 'music';
alter type public.task_category add value if not exists 'animation' after '3d';
alter type public.task_category add value if not exists 'mobile' after 'data';
alter type public.task_category add value if not exists 'gamedev' after 'mobile';
alter type public.task_category add value if not exists 'ai' after 'gamedev';
alter type public.task_category add value if not exists 'tutor' after 'ai';
alter type public.task_category add value if not exists 'legal' after 'tutor';
alter type public.task_category add value if not exists 'finance' after 'legal';
alter type public.task_category add value if not exists 'business' after 'finance';
alter type public.task_category add value if not exists 'voiceover' after 'business';
alter type public.task_category add value if not exists 'podcast' after 'voiceover';
