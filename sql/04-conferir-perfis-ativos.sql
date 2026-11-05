-- Conferência somente leitura dos perfis (sem e-mails e sem senhas)
SELECT RIGHT(user_id::text,4) AS final_id,role,active
FROM public.profiles
WHERE RIGHT(user_id::text,4) IN ('30b4','8632')
ORDER BY final_id;
