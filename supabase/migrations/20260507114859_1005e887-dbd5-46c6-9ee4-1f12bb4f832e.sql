CREATE POLICY "votes_delete" ON public.votes FOR DELETE USING (true);
CREATE POLICY "tea_delete" ON public.tea FOR DELETE USING (true);
CREATE POLICY "devices_delete" ON public.devices FOR DELETE USING (true);